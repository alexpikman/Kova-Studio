import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { ensureKovaDirs, getModelsManifestPath } from './paths';

export type ManagedModelStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'ready'
  | 'corrupt'
  | 'error';

export type ModelSourceType = 'huggingface' | 'direct-url' | 'ollama' | 'local-import';

export interface ManagedModelRecord {
  id: string;
  repoId: string;
  name: string;
  quant: string;
  filename: string;
  sourceType: ModelSourceType;
  downloadUrl?: string;
  localPath: string;
  partPath?: string;
  sizeGb: number;
  minVramGb: number;
  minRamGb: number;
  license: string;
  expectedSha256: string | null;
  computedSha256: string | null;
  sha256Verified: boolean;
  status: ManagedModelStatus;
  progressPct: number;
  speedBps: number;
  speedMbps: number;
  etaSeconds: number | null;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface ModelsManifest {
  activeModelId: string;
  models: ManagedModelRecord[];
}

const MAX_CONCURRENT_DOWNLOADS = 2;
const activeControllers = new Map<string, AbortController>();

function readManifest(): ModelsManifest {
  const manifestPath = getModelsManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return { activeModelId: '', models: [] };
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as ModelsManifest;
    return {
      activeModelId: typeof parsed.activeModelId === 'string' ? parsed.activeModelId : '',
      models: Array.isArray(parsed.models) ? parsed.models : [],
    };
  } catch {
    return { activeModelId: '', models: [] };
  }
}

function writeManifest(manifest: ModelsManifest): void {
  const manifestPath = getModelsManifestPath();
  const tmpPath = `${manifestPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf-8');
  fs.renameSync(tmpPath, manifestPath);
}

function mutateModel(id: string, updater: (m: ManagedModelRecord) => ManagedModelRecord): ManagedModelRecord | null {
  const manifest = readManifest();
  const idx = manifest.models.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const updated = updater({ ...manifest.models[idx], updatedAt: new Date().toISOString() });
  manifest.models[idx] = updated;
  writeManifest(manifest);
  return updated;
}

export function listLocalModels(): { activeModelId: string; models: ManagedModelRecord[]; modelsDir: string } {
  const { modelsDir } = ensureKovaDirs();
  const manifest = readManifest();

  // Reconcile disk state on read: if a 'downloading' job has no active controller (e.g. after server restart), mark paused with exact .part byte count
  let changed = false;
  const reconciled = manifest.models.map((m) => {
    if ((m.status === 'downloading' || m.status === 'verifying') && !activeControllers.has(m.id)) {
      const targetPart = m.partPath || `${m.localPath}.part`;
      const partBytes = fs.existsSync(targetPart) ? fs.statSync(targetPart).size : m.downloadedBytes;
      const pct = m.totalBytes > 0 ? Math.min(99, Math.round((partBytes / m.totalBytes) * 100)) : m.progressPct;
      changed = true;
      return {
        ...m,
        status: 'paused' as const,
        downloadedBytes: partBytes,
        progressPct: pct,
        speedBps: 0,
        speedMbps: 0,
        etaSeconds: null,
        updatedAt: new Date().toISOString(),
      };
    }
    return m;
  });

  if (changed) {
    manifest.models = reconciled;
    writeManifest(manifest);
  }

  return {
    activeModelId: manifest.activeModelId,
    models: reconciled,
    modelsDir,
  };
}

export function getLocalModel(id: string): ManagedModelRecord | null {
  const manifest = readManifest();
  return manifest.models.find((m) => m.id === id) ?? null;
}

export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function checkFreeDiskSpaceBytes(dirPath: string): number | null {
  try {
    const stat = fs.statfsSync(dirPath);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    return null;
  }
}

function activeDownloadingCount(): number {
  const manifest = readManifest();
  return manifest.models.filter((m) => m.status === 'downloading' && activeControllers.has(m.id)).length;
}

function pumpDownloadQueue(): void {
  const running = activeDownloadingCount();
  if (running >= MAX_CONCURRENT_DOWNLOADS) return;
  const manifest = readManifest();
  const nextQueued = manifest.models.find((m) => m.status === 'queued');
  if (nextQueued) {
    void executeHttpDownload(nextQueued.id);
  }
}

async function executeHttpDownload(id: string): Promise<void> {
  const record = getLocalModel(id);
  if (!record || !record.downloadUrl) return;

  const partPath = record.partPath || `${record.localPath}.part`;
  fs.mkdirSync(path.dirname(partPath), { recursive: true });

  const existingOffset = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;

  // Verify free disk space before downloading
  if (record.totalBytes > 0) {
    const freeBytes = checkFreeDiskSpaceBytes(path.dirname(partPath));
    const remainingNeeded = Math.max(0, record.totalBytes - existingOffset);
    if (freeBytes !== null && remainingNeeded > freeBytes) {
      mutateModel(id, (m) => ({
        ...m,
        status: 'error',
        speedBps: 0,
        speedMbps: 0,
        etaSeconds: null,
        errorMessage: `Недостаточно места на диске: нужно ${(remainingNeeded / 1e9).toFixed(2)} GB, свободно ${(freeBytes / 1e9).toFixed(2)} GB`,
      }));
      pumpDownloadQueue();
      return;
    }
  }

  const controller = new AbortController();
  activeControllers.set(id, controller);

  mutateModel(id, (m) => ({
    ...m,
    status: 'downloading',
    downloadedBytes: existingOffset,
    errorMessage: undefined,
  }));

  let writeStream: fs.WriteStream | null = null;
  let abortedByPause = false;

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'KovaStudio/1.0',
    };
    if (existingOffset > 0) {
      headers.Range = `bytes=${existingOffset}-`;
    }

    const response = await fetch(record.downloadUrl, {
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });

    if (response.status === 416 && existingOffset > 0) {
      // Server says range is already at/past EOF; proceed straight to verification
      await finalizeAndVerifyDownload(id, partPath, record.localPath, record.expectedSha256);
      return;
    }

    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP ${response.status} ${response.statusText} (${record.downloadUrl})`);
    }

    const isPartial = response.status === 206;
    const contentLengthHeader = Number(response.headers.get('content-length') || 0);
    const contentRange = response.headers.get('content-range');
    let totalBytes = record.totalBytes;

    if (contentRange) {
      const m = contentRange.match(/\/(\d+)$/);
      if (m) totalBytes = Number(m[1]);
    } else if (contentLengthHeader > 0) {
      totalBytes = isPartial ? existingOffset + contentLengthHeader : contentLengthHeader;
    }

    const startOffset = isPartial ? existingOffset : 0;
    if (!isPartial && existingOffset > 0 && fs.existsSync(partPath)) {
      // Server ignored Range and returned 200 OK; start clean from byte 0
      fs.truncateSync(partPath, 0);
    }

    // Check disk space again if Content-Length revealed actual size
    if (totalBytes > 0) {
      const freeBytes = checkFreeDiskSpaceBytes(path.dirname(partPath));
      if (freeBytes !== null && totalBytes - startOffset > freeBytes) {
        throw new Error(
          `Недостаточно места на диске: файл ${(totalBytes / 1e9).toFixed(2)} GB, свободно ${(freeBytes / 1e9).toFixed(2)} GB`,
        );
      }
    }

    writeStream = fs.createWriteStream(partPath, { flags: isPartial ? 'a' : 'w' });
    let downloadedBytes = startOffset;
    let lastTickTs = Date.now();
    let lastTickBytes = downloadedBytes;
    let lastPersistTs = Date.now();

    if (!response.body) {
      throw new Error('Сервер вернул пустой поток ответа');
    }

    const nodeReadable = Readable.fromWeb(response.body as unknown as import('stream/web').ReadableStream);

    for await (const chunk of nodeReadable) {
      if (controller.signal.aborted) {
        abortedByPause = true;
        break;
      }
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      await new Promise<void>((resolve, reject) => {
        if (!writeStream) return reject(new Error('Stream closed'));
        const ok = writeStream.write(buf, (err) => {
          if (err) reject(err);
          else resolve();
        });
        if (!ok) {
          writeStream.once('drain', resolve);
        }
      });

      downloadedBytes += buf.length;
      const now = Date.now();
      const dt = (now - lastTickTs) / 1000;
      if (now - lastPersistTs >= 180) {
        const speedBps = dt > 0.05 ? Math.round((downloadedBytes - lastTickBytes) / dt) : 0;
        const speedMbps = Number((speedBps / (1024 * 1024)).toFixed(2));
        const pct = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
        const etaSeconds =
          totalBytes > downloadedBytes && speedBps > 0
            ? Math.ceil((totalBytes - downloadedBytes) / speedBps)
            : null;

        mutateModel(id, (m) => ({
          ...m,
          status: 'downloading',
          downloadedBytes,
          totalBytes,
          sizeGb: totalBytes > 0 ? Number((totalBytes / (1024 * 1024 * 1024)).toFixed(4)) : m.sizeGb,
          progressPct: pct,
          speedBps,
          speedMbps,
          etaSeconds,
        }));
        lastTickTs = now;
        lastTickBytes = downloadedBytes;
        lastPersistTs = now;
      }
    }

    await new Promise<void>((resolve) => {
      if (!writeStream) return resolve();
      writeStream.end(() => resolve());
    });
    writeStream = null;

    if (controller.signal.aborted || abortedByPause) {
      const currentBytes = fs.existsSync(partPath) ? fs.statSync(partPath).size : downloadedBytes;
      const pct = totalBytes > 0 ? Math.min(99, Math.round((currentBytes / totalBytes) * 100)) : 0;
      const current = getLocalModel(id);
      if (current) {
        mutateModel(id, (m) => ({
          ...m,
          status: 'paused',
          downloadedBytes: currentBytes,
          totalBytes,
          progressPct: pct,
          speedBps: 0,
          speedMbps: 0,
          etaSeconds: null,
        }));
      }
      return;
    }

    await finalizeAndVerifyDownload(id, partPath, record.localPath, record.expectedSha256, totalBytes);
  } catch (err) {
    if (writeStream) {
      await new Promise<void>((resolve) => writeStream!.end(() => resolve()));
    }
    const isAbort =
      controller.signal.aborted ||
      (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted')));
    if (isAbort) {
      const currentBytes = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
      const current = getLocalModel(id);
      if (current && current.status !== 'corrupt') {
        const pct =
          current.totalBytes > 0 ? Math.min(99, Math.round((currentBytes / current.totalBytes) * 100)) : 0;
        mutateModel(id, (m) => ({
          ...m,
          status: 'paused',
          downloadedBytes: currentBytes,
          progressPct: pct,
          speedBps: 0,
          speedMbps: 0,
          etaSeconds: null,
        }));
      }
    } else {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки файла';
      mutateModel(id, (m) => ({
        ...m,
        status: 'error',
        speedBps: 0,
        speedMbps: 0,
        etaSeconds: null,
        errorMessage: message,
      }));
    }
  } finally {
    activeControllers.delete(id);
    pumpDownloadQueue();
  }
}

async function finalizeAndVerifyDownload(
  id: string,
  partPath: string,
  finalPath: string,
  expectedSha256: string | null,
  knownTotalBytes?: number,
): Promise<void> {
  const actualBytes = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
  mutateModel(id, (m) => ({
    ...m,
    status: 'verifying',
    downloadedBytes: actualBytes,
    totalBytes: knownTotalBytes && knownTotalBytes > 0 ? knownTotalBytes : actualBytes,
    progressPct: 100,
    speedBps: 0,
    speedMbps: 0,
    etaSeconds: 0,
  }));

  const digest = await computeFileSha256(partPath);
  const hasValidExpected = Boolean(expectedSha256 && /^[a-f0-9]{64}$/i.test(expectedSha256.trim()));

  if (hasValidExpected && digest.toLowerCase() !== expectedSha256!.trim().toLowerCase()) {
    mutateModel(id, (m) => ({
      ...m,
      status: 'corrupt',
      computedSha256: digest,
      sha256Verified: false,
      errorMessage: `Ошибка целостности SHA256: ожидался ${expectedSha256}, получен ${digest}. Активация заблокирована.`,
    }));
    return;
  }

  fs.renameSync(partPath, finalPath);
  mutateModel(id, (m) => ({
    ...m,
    status: 'ready',
    localPath: finalPath,
    computedSha256: digest,
    sha256Verified: true,
    sizeGb: Number((actualBytes / (1024 * 1024 * 1024)).toFixed(4)),
    downloadedBytes: actualBytes,
    totalBytes: actualBytes,
    progressPct: 100,
    speedBps: 0,
    speedMbps: 0,
    etaSeconds: 0,
    errorMessage: undefined,
  }));
}

export function startModelDownload(input: {
  repoId: string;
  name: string;
  quant: string;
  filename: string;
  downloadUrl: string;
  sizeGb?: number;
  totalBytes?: number;
  minVramGb?: number;
  minRamGb?: number;
  license?: string;
  expectedSha256?: string | null;
  targetDir?: string;
}): ManagedModelRecord {
  const { modelsDir } = ensureKovaDirs();
  const baseDir = input.targetDir?.trim() ? path.resolve(input.targetDir.trim()) : modelsDir;
  fs.mkdirSync(baseDir, { recursive: true });

  const safeFilename = path.basename(input.filename.trim() || 'model.gguf');
  const finalPath = path.join(baseDir, safeFilename);
  const partPath = `${finalPath}.part`;

  const manifest = readManifest();
  const existing = manifest.models.find(
    (m) => m.localPath === finalPath || (m.repoId === input.repoId && m.quant === input.quant),
  );

  if (existing) {
    if (existing.status === 'paused' || existing.status === 'error') {
      return resumeModelDownload(existing.id)!;
    }
    return existing;
  }

  const totalBytes = input.totalBytes && input.totalBytes > 0
    ? input.totalBytes
    : input.sizeGb && input.sizeGb > 0
      ? Math.round(input.sizeGb * 1024 * 1024 * 1024)
      : 0;

  const id = `mdl-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const shouldQueue = activeDownloadingCount() >= MAX_CONCURRENT_DOWNLOADS;
  const now = new Date().toISOString();

  const record: ManagedModelRecord = {
    id,
    repoId: input.repoId,
    name: input.name,
    quant: input.quant || 'GGUF',
    filename: safeFilename,
    sourceType: input.repoId.startsWith('direct/') ? 'direct-url' : 'huggingface',
    downloadUrl: input.downloadUrl,
    localPath: finalPath,
    partPath,
    sizeGb: input.sizeGb ?? (totalBytes > 0 ? Number((totalBytes / (1024 * 1024 * 1024)).toFixed(3)) : 0),
    minVramGb: input.minVramGb ?? Number(((input.sizeGb ?? 4) * 1.15 + 0.7).toFixed(2)),
    minRamGb: input.minRamGb ?? Number(((input.sizeGb ?? 4) * 1.2 + 1.2).toFixed(2)),
    license: input.license || 'open-weights',
    expectedSha256: input.expectedSha256 ?? null,
    computedSha256: null,
    sha256Verified: false,
    status: shouldQueue ? 'queued' : 'downloading',
    progressPct: 0,
    speedBps: 0,
    speedMbps: 0,
    etaSeconds: null,
    downloadedBytes: 0,
    totalBytes,
    createdAt: now,
    updatedAt: now,
  };

  manifest.models.unshift(record);
  writeManifest(manifest);

  if (!shouldQueue) {
    void executeHttpDownload(id);
  }

  return record;
}

export function pauseModelDownload(id: string): ManagedModelRecord | null {
  const record = getLocalModel(id);
  if (!record) return null;

  const ctrl = activeControllers.get(id);
  if (ctrl) {
    ctrl.abort();
  }

  const partPath = record.partPath || `${record.localPath}.part`;
  const bytes = fs.existsSync(partPath) ? fs.statSync(partPath).size : record.downloadedBytes;
  const pct = record.totalBytes > 0 ? Math.min(99, Math.round((bytes / record.totalBytes) * 100)) : record.progressPct;

  return mutateModel(id, (m) => ({
    ...m,
    status: 'paused',
    downloadedBytes: bytes,
    progressPct: pct,
    speedBps: 0,
    speedMbps: 0,
    etaSeconds: null,
  }));
}

export function resumeModelDownload(id: string): ManagedModelRecord | null {
  const record = getLocalModel(id);
  if (!record) return null;
  if (record.status === 'ready') return record;
  if (activeControllers.has(id)) return record;

  if (record.sourceType === 'ollama') {
    return startOllamaModelPull({ modelName: record.name, existingId: record.id });
  }

  if (activeDownloadingCount() >= MAX_CONCURRENT_DOWNLOADS) {
    return mutateModel(id, (m) => ({ ...m, status: 'queued', errorMessage: undefined }));
  }

  void executeHttpDownload(id);
  return getLocalModel(id);
}

export function deleteLocalModel(id: string): { deleted: boolean; freedBytes: number; activeModelId: string } {
  const ctrl = activeControllers.get(id);
  if (ctrl) {
    ctrl.abort();
    activeControllers.delete(id);
  }

  const manifest = readManifest();
  const target = manifest.models.find((m) => m.id === id);
  if (!target) {
    return { deleted: false, freedBytes: 0, activeModelId: manifest.activeModelId };
  }

  let freedBytes = 0;
  for (const p of [target.localPath, target.partPath, `${target.localPath}.part`]) {
    if (!p) continue;
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        freedBytes += fs.statSync(p).size;
        fs.unlinkSync(p);
      }
    } catch {
      // ignore individual unlink failure
    }
  }

  manifest.models = manifest.models.filter((m) => m.id !== id);
  if (manifest.activeModelId === id) {
    manifest.activeModelId = manifest.models.find((m) => m.status === 'ready')?.id ?? '';
  }
  writeManifest(manifest);
  pumpDownloadQueue();

  return {
    deleted: true,
    freedBytes,
    activeModelId: manifest.activeModelId,
  };
}

export function activateLocalModel(id: string): { ok: boolean; error?: string; activeModelId: string } {
  const manifest = readManifest();
  const target = manifest.models.find((m) => m.id === id);
  if (!target) {
    return { ok: false, error: 'Модель не найдена в манифесте models.json', activeModelId: manifest.activeModelId };
  }
  if (target.status === 'corrupt') {
    return {
      ok: false,
      error: target.errorMessage || 'Файл модели повреждён (SHA256 не совпал). Активация заблокирована.',
      activeModelId: manifest.activeModelId,
    };
  }
  if (target.status !== 'ready') {
    return {
      ok: false,
      error: `Модель ещё не готова (статус: ${target.status}). Завершите загрузку перед активацией.`,
      activeModelId: manifest.activeModelId,
    };
  }
  if (target.sourceType !== 'ollama' && !fs.existsSync(target.localPath)) {
    return {
      ok: false,
      error: `Файл модели отсутствует на диске: ${target.localPath}`,
      activeModelId: manifest.activeModelId,
    };
  }

  manifest.activeModelId = id;
  writeManifest(manifest);
  return { ok: true, activeModelId: id };
}

export async function importLocalModelFile(filePathInput: string): Promise<ManagedModelRecord> {
  const resolved = path.resolve(filePathInput.trim());
  if (!fs.existsSync(resolved)) {
    throw new Error(`Файл не найден: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`Указанный путь не является файлом: ${resolved}`);
  }
  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.gguf' && ext !== '.safetensors') {
    throw new Error('Поддерживаются только файлы форматов .gguf и .safetensors');
  }

  // Verify GGUF magic header if .gguf
  if (ext === '.gguf') {
    const fd = fs.openSync(resolved, 'r');
    const magic = Buffer.alloc(4);
    fs.readSync(fd, magic, 0, 4, 0);
    fs.closeSync(fd);
    if (magic.toString('ascii') !== 'GGUF') {
      throw new Error('Некорректный заголовок файла GGUF (отсутствует сигнатура GGUF)');
    }
  }

  const digest = await computeFileSha256(resolved);
  const filename = path.basename(resolved);
  const quantMatch = filename.match(/(Q\d_[A-Z0-9_]+|IQ\d_[A-Z0-9_]+|F16|BF16)/i);
  const quant = quantMatch ? quantMatch[1].toUpperCase() : ext === '.safetensors' ? 'SAFETENSORS' : 'GGUF';
  const sizeGb = Number((stat.size / (1024 * 1024 * 1024)).toFixed(4));

  const manifest = readManifest();
  const existing = manifest.models.find((m) => m.localPath === resolved);
  if (existing) {
    return mutateModel(existing.id, (m) => ({
      ...m,
      status: 'ready',
      computedSha256: digest,
      sha256Verified: true,
      downloadedBytes: stat.size,
      totalBytes: stat.size,
      sizeGb,
      progressPct: 100,
    }))!;
  }

  const now = new Date().toISOString();
  const record: ManagedModelRecord = {
    id: `imp-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    repoId: `local/${filename}`,
    name: filename.replace(/\.(gguf|safetensors)$/i, ''),
    quant,
    filename,
    sourceType: 'local-import',
    localPath: resolved,
    sizeGb,
    minVramGb: Number((sizeGb * 1.15 + 0.7).toFixed(2)),
    minRamGb: Number((sizeGb * 1.2 + 1.2).toFixed(2)),
    license: 'local-file',
    expectedSha256: digest,
    computedSha256: digest,
    sha256Verified: true,
    status: 'ready',
    progressPct: 100,
    speedBps: 0,
    speedMbps: 0,
    etaSeconds: 0,
    downloadedBytes: stat.size,
    totalBytes: stat.size,
    createdAt: now,
    updatedAt: now,
  };

  manifest.models.unshift(record);
  writeManifest(manifest);
  return record;
}

export function startOllamaModelPull(input: {
  modelName: string;
  ollamaUrl?: string;
  existingId?: string;
}): ManagedModelRecord {
  const baseUrl = (input.ollamaUrl?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const cleanName = input.modelName.trim();
  if (!cleanName) {
    throw new Error('Укажите имя модели Ollama (например: qwen2.5-coder:7b)');
  }

  const manifest = readManifest();
  const id = input.existingId || `ollama-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  let record = manifest.models.find((m) => m.id === id);

  if (!record) {
    record = {
      id,
      repoId: `ollama/${cleanName}`,
      name: cleanName,
      quant: 'Ollama',
      filename: cleanName,
      sourceType: 'ollama',
      downloadUrl: `${baseUrl}/api/pull`,
      localPath: `ollama://${cleanName}`,
      sizeGb: 0,
      minVramGb: 5.5,
      minRamGb: 8.0,
      license: 'ollama-registry',
      expectedSha256: null,
      computedSha256: null,
      sha256Verified: false,
      status: 'downloading',
      progressPct: 0,
      speedBps: 0,
      speedMbps: 0,
      etaSeconds: null,
      downloadedBytes: 0,
      totalBytes: 0,
      createdAt: now,
      updatedAt: now,
    };
    manifest.models.unshift(record);
    writeManifest(manifest);
  }

  const ctrl = new AbortController();
  activeControllers.set(id, ctrl);

  void (async () => {
    try {
      const resp = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, stream: true }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Ollama вернул HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastTick = Date.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as {
              status?: string;
              completed?: number;
              total?: number;
              digest?: string;
              error?: string;
            };
            if (ev.error) throw new Error(ev.error);
            if (typeof ev.completed === 'number' && typeof ev.total === 'number' && ev.total > 0) {
              const nowTs = Date.now();
              const dt = (nowTs - lastTick) / 1000;
              const speedBps = dt > 0.1 ? Math.max(0, Math.round((ev.completed - lastBytes) / dt)) : 0;
              const pct = Math.min(99, Math.round((ev.completed / ev.total) * 100));
              mutateModel(id, (m) => ({
                ...m,
                status: 'downloading',
                downloadedBytes: ev.completed!,
                totalBytes: ev.total!,
                sizeGb: Number((ev.total! / 1e9).toFixed(2)),
                progressPct: pct,
                speedBps,
                speedMbps: Number((speedBps / (1024 * 1024)).toFixed(2)),
                etaSeconds: speedBps > 0 ? Math.ceil((ev.total! - ev.completed!) / speedBps) : null,
              }));
              lastTick = nowTs;
              lastBytes = ev.completed;
            }
            if (ev.status === 'success') {
              mutateModel(id, (m) => ({
                ...m,
                status: 'ready',
                progressPct: 100,
                sha256Verified: true,
                speedBps: 0,
                speedMbps: 0,
                etaSeconds: 0,
                errorMessage: undefined,
              }));
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && !parseErr.message.includes('JSON')) {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ollama недоступен';
      const friendly =
        msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
          ? `Локальный сервис Ollama (${baseUrl}) не запущен на этом устройстве`
          : msg;
      mutateModel(id, (m) => ({
        ...m,
        status: ctrl.signal.aborted ? 'paused' : 'error',
        speedBps: 0,
        speedMbps: 0,
        errorMessage: ctrl.signal.aborted ? undefined : friendly,
      }));
    } finally {
      activeControllers.delete(id);
    }
  })();

  return record;
}
