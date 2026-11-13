import express from 'express';
import fs from 'fs';
import path from 'path';
import { browseDirectory, createDirectory, tryNativeFolderPicker } from './fsBrowse';
import { detectHardware, recommendModelForHardware } from './hardware';
import {
  activateLocalModel,
  deleteLocalModel,
  importLocalModelFile,
  listLocalModels,
  pauseModelDownload,
  resumeModelDownload,
  startModelDownload,
  startOllamaModelPull,
} from './modelsManager';
import {
  execProjectCommand,
  executeProjectTask,
  listProjectFiles,
  readProjectActionLog,
  readProjectFile,
  runProjectGit,
  searchProjectCode,
  undoLastProjectAction,
  writeProjectFile,
} from './projectAgent';
import {
  createOrUpdateProject,
  deleteProjectRecord,
  listProjects,
  setActiveProjectId,
  verifySshConnectionAndPath,
} from './projectsManager';

interface HFModelRaw {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  lastModified?: string;
}

interface HFSiblingRaw {
  rfilename: string;
  size?: number;
  lfs?: {
    sha256?: string;
    size?: number;
  };
}

interface HFModelDetailRaw extends HFModelRaw {
  siblings?: HFSiblingRaw[];
  cardData?: {
    license?: string | string[];
  };
}

const searchCache = new Map<string, { ts: number; data: unknown }>();
const detailCache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 1000 * 60 * 3;

function extractLicense(tags: string[] = [], cardLicense?: string | string[]): string {
  if (typeof cardLicense === 'string' && cardLicense.trim()) {
    return cardLicense;
  }
  if (Array.isArray(cardLicense) && cardLicense.length > 0) {
    return cardLicense[0];
  }
  const licenseTag = tags.find((t) => t.startsWith('license:'));
  return licenseTag ? licenseTag.replace('license:', '') : 'open-weights';
}

function inferQuantizations(tags: string[] = [], id: string): string[] {
  const known = ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0', 'IQ4_XS'];
  const upperId = id.toUpperCase();
  const matched = known.filter((q) => upperId.includes(q) || tags.some((t) => t.toUpperCase().includes(q)));
  return matched.length > 0 ? matched : ['Q4_K_M', 'Q5_K_M'];
}

function estimateParamsBillions(id: string): number {
  const match = id.match(/(\d+(?:\.\d+)?)\s*[bB](?![a-zA-Z])/);
  if (match) {
    const val = parseFloat(match[1]);
    if (!Number.isNaN(val) && val > 0 && val <= 200) return val;
  }
  return 7;
}

export function createApiApp(rootDir: string = process.cwd()): express.Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'kova-studio-backend', timestamp: Date.now() });
  });

  // =========================================================================
  // 1. Hardware Detection & Model Recommendation (§1)
  // =========================================================================
  app.get('/api/hardware', async (req, res) => {
    try {
      const targetDir = typeof req.query.dir === 'string' ? req.query.dir : undefined;
      const profile = await detectHardware(targetDir);
      res.json({ ok: true, hardware: profile });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка детекта железа' });
    }
  });

  app.post('/api/hardware/recommend', async (req, res) => {
    try {
      const models = Array.isArray(req.body?.models) ? req.body.models : [];
      const hw = req.body?.hardware ?? (await detectHardware());
      const recommendations = models.map((m: {
        id: string;
        name: string;
        quant?: string;
        sizeGb: number;
        minVramGb?: number;
        minRamGb?: number;
      }) =>
        recommendModelForHardware(
          {
            id: m.id,
            name: m.name,
            quant: m.quant || 'Q4_K_M',
            sizeGb: Number(m.sizeGb) || 4,
            minVramGb: m.minVramGb,
            minRamGb: m.minRamGb,
          },
          hw,
        ),
      );
      res.json({ ok: true, hardware: hw, recommendations });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка подбора моделей' });
    }
  });

  // =========================================================================
  // 2. Real Local Model Manager & Resumable Streaming Downloads (§2)
  // =========================================================================
  app.get('/api/models/local', (_req, res) => {
    try {
      const state = listLocalModels();
      res.json({ ok: true, ...state });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка чтения models.json' });
    }
  });

  app.post('/api/models/download', (req, res) => {
    try {
      const {
        repoId,
        name,
        quant,
        filename,
        downloadUrl,
        sizeGb,
        totalBytes,
        minVramGb,
        minRamGb,
        license,
        expectedSha256,
        targetDir,
      } = req.body ?? {};

      if (!downloadUrl || typeof downloadUrl !== 'string') {
        res.status(400).json({ ok: false, error: 'Не указан downloadUrl для скачивания модели' });
        return;
      }

      const record = startModelDownload({
        repoId: typeof repoId === 'string' && repoId ? repoId : `direct/${filename || 'model.gguf'}`,
        name: typeof name === 'string' && name ? name : filename || 'GGUF Model',
        quant: typeof quant === 'string' ? quant : 'GGUF',
        filename: typeof filename === 'string' && filename ? filename : 'model.gguf',
        downloadUrl,
        sizeGb: typeof sizeGb === 'number' ? sizeGb : undefined,
        totalBytes: typeof totalBytes === 'number' ? totalBytes : undefined,
        minVramGb: typeof minVramGb === 'number' ? minVramGb : undefined,
        minRamGb: typeof minRamGb === 'number' ? minRamGb : undefined,
        license: typeof license === 'string' ? license : 'open-weights',
        expectedSha256: typeof expectedSha256 === 'string' ? expectedSha256 : null,
        targetDir: typeof targetDir === 'string' ? targetDir : undefined,
      });

      res.status(202).json({ ok: true, model: record });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка запуска загрузки' });
    }
  });

  app.post('/api/models/download/:id/pause', (req, res) => {
    const model = pauseModelDownload(req.params.id);
    if (!model) {
      res.status(404).json({ ok: false, error: 'Загрузка не найдена' });
      return;
    }
    res.json({ ok: true, model });
  });

  app.post('/api/models/download/:id/resume', (req, res) => {
    const model = resumeModelDownload(req.params.id);
    if (!model) {
      res.status(404).json({ ok: false, error: 'Модель не найдена' });
      return;
    }
    res.json({ ok: true, model });
  });

  app.post('/api/models/ollama/pull', (req, res) => {
    try {
      const modelName = typeof req.body?.modelName === 'string' ? req.body.modelName : '';
      const ollamaUrl = typeof req.body?.ollamaUrl === 'string' ? req.body.ollamaUrl : undefined;
      const model = startOllamaModelPull({ modelName, ollamaUrl });
      res.status(202).json({ ok: true, model });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка Ollama pull' });
    }
  });

  app.post('/api/models/import', async (req, res) => {
    try {
      const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath : '';
      const model = await importLocalModelFile(filePath);
      res.json({ ok: true, model });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка импорта файла' });
    }
  });

  app.post('/api/models/local/:id/activate', (req, res) => {
    const result = activateLocalModel(req.params.id);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  app.delete('/api/models/local/:id', (req, res) => {
    const result = deleteLocalModel(req.params.id);
    res.json({ ok: result.deleted, ...result });
  });

  // =========================================================================
  // 3. Hugging Face Search & Model File Blobs Proxy (§1 & §2)
  // =========================================================================
  app.get('/api/hf/models', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filterMode = typeof req.query.mode === 'string' ? req.query.mode : 'llama.cpp';
    const cacheKey = `${filterMode}::${q.toLowerCase()}`;

    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      res.json(cached.data);
      return;
    }

    try {
      const url = new URL('https://huggingface.co/api/models');
      if (filterMode === 'llama.cpp') {
        url.searchParams.set('apps', 'llama.cpp');
      } else {
        url.searchParams.set('filter', 'gguf');
      }
      url.searchParams.set('sort', 'downloads');
      url.searchParams.set('direction', '-1');
      url.searchParams.set('limit', '18');
      url.searchParams.set('search', q || 'coder gguf');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'KovaStudio/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Hugging Face API returned ${response.status}`);
      }

      const rawModels = (await response.json()) as HFModelRaw[];
      const normalized = rawModels
        .filter((m) => m.id)
        .slice(0, 15)
        .map((m) => {
          const paramsB = estimateParamsBillions(m.id);
          const estQ4SizeGb = Number((paramsB * 0.62 + 0.4).toFixed(1));
          const estVramGb = Number((estQ4SizeGb + 1.1).toFixed(1));
          const estRamGb = Number((estVramGb + 2.0).toFixed(1));
          const author = m.author || m.id.split('/')[0] || 'community';
          const name = m.id.includes('/') ? m.id.split('/')[1] : m.id;

          return {
            id: m.id,
            repoId: m.id,
            name,
            author,
            downloads: m.downloads ?? 0,
            likes: m.likes ?? 0,
            license: extractLicense(m.tags),
            lastModified: m.lastModified ?? new Date().toISOString(),
            tags: (m.tags ?? []).slice(0, 8),
            quantizations: inferQuantizations(m.tags, m.id),
            defaultQuant: 'Q4_K_M',
            sizeGb: estQ4SizeGb,
            minVramGb: estVramGb,
            minRamGb: estRamGb,
            source: 'huggingface' as const,
            url: `https://huggingface.co/${m.id}`,
          };
        });

      const payload = {
        source: 'huggingface-live',
        query: q,
        count: normalized.length,
        models: normalized,
      };
      searchCache.set(cacheKey, { ts: Date.now(), data: payload });
      res.json(payload);
    } catch (err) {
      res.status(502).json({
        source: 'huggingface-error',
        error: err instanceof Error ? err.message : 'Network error',
        models: [],
      });
    }
  });

  app.get('/api/hf/model', async (req, res) => {
    const repoId = typeof req.query.repoId === 'string' ? req.query.repoId.trim() : '';
    if (!repoId || !repoId.includes('/')) {
      res.status(400).json({ error: 'Valid repoId (owner/model) is required' });
      return;
    }

    const cached = detailCache.get(repoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      res.json(cached.data);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const encodedRepo = repoId.split('/').map((s) => encodeURIComponent(s)).join('/');

      const response = await fetch(`https://huggingface.co/api/models/${encodedRepo}?blobs=true`, {
        headers: { Accept: 'application/json', 'User-Agent': 'KovaStudio/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Hugging Face model API returned ${response.status}`);
      }

      const raw = (await response.json()) as HFModelDetailRaw;
      const ggufFiles = (raw.siblings ?? [])
        .filter((s) => s.rfilename.toLowerCase().endsWith('.gguf'))
        .map((s) => {
          const bytes = s.lfs?.size ?? s.size ?? 0;
          const sizeGb = Number((bytes / (1024 * 1024 * 1024)).toFixed(2));
          const quantMatch = s.rfilename.match(/(Q\d_[A-Z0-9_]+|IQ\d_[A-Z0-9_]+|F16|BF16)/i);
          return {
            filename: s.rfilename,
            quant: quantMatch ? quantMatch[1].toUpperCase() : 'GGUF',
            sizeBytes: bytes,
            sizeGb,
            sha256: s.lfs?.sha256 ?? null,
            downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${s.rfilename}`,
          };
        })
        .sort((a, b) => a.sizeBytes - b.sizeBytes);

      const payload = {
        repoId: raw.id,
        license: extractLicense(raw.tags, raw.cardData?.license),
        downloads: raw.downloads ?? 0,
        likes: raw.likes ?? 0,
        files: ggufFiles,
      };
      detailCache.set(repoId, { ts: Date.now(), data: payload });
      res.json(payload);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Network error', files: [] });
    }
  });

  // =========================================================================
  // 4. Filesystem Directory Browser & Native Folder Picker (§4.2)
  // =========================================================================
  app.get('/api/fs/browse', async (req, res) => {
    try {
      const dir = typeof req.query.path === 'string' ? req.query.path : undefined;
      const result = await browseDirectory(dir);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка обзора папок' });
    }
  });

  app.post('/api/fs/mkdir', async (req, res) => {
    try {
      const parentDir = typeof req.body?.parentDir === 'string' ? req.body.parentDir : '';
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      const created = await createDirectory(parentDir, name);
      res.json({ ok: true, ...created });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка создания папки' });
    }
  });

  app.post('/api/fs/pick-native', async (_req, res) => {
    const result = await tryNativeFolderPicker();
    res.json(result);
  });

  // =========================================================================
  // 5. Real Projects CRUD & Real Workspace Operations (§3 & §4)
  // =========================================================================
  app.get('/api/projects', (_req, res) => {
    res.json({ ok: true, ...listProjects() });
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const project = await createOrUpdateProject(req.body ?? {});
      res.status(201).json({ ok: true, project });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка сохранения проекта' });
    }
  });

  app.put('/api/projects/:id', async (req, res) => {
    try {
      const project = await createOrUpdateProject({ ...(req.body ?? {}), id: req.params.id });
      res.json({ ok: true, project });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка обновления проекта' });
    }
  });

  app.post('/api/projects/:id/activate', (req, res) => {
    try {
      const result = setActiveProjectId(req.params.id);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(404).json({ ok: false, error: err instanceof Error ? err.message : 'Проект не найден' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    const result = await deleteProjectRecord(req.params.id);
    res.json({ ok: result.deleted, ...result });
  });

  app.get('/api/projects/:id/files', (req, res) => {
    try {
      const files = listProjectFiles(req.params.id);
      res.json({ ok: true, files });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка списка файлов' });
    }
  });

  app.get('/api/projects/:id/file', (req, res) => {
    try {
      const relPath = typeof req.query.path === 'string' ? req.query.path : '';
      const file = readProjectFile(req.params.id, relPath);
      res.json({ ok: true, ...file });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка чтения файла' });
    }
  });

  app.put('/api/projects/:id/file', (req, res) => {
    try {
      const filePath = typeof req.body?.path === 'string' ? req.body.path : '';
      const content = typeof req.body?.content === 'string' ? req.body.content : '';
      const summary = typeof req.body?.summary === 'string' ? req.body.summary : undefined;
      const result = writeProjectFile(req.params.id, filePath, content, summary);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка записи файла' });
    }
  });

  app.get('/api/projects/:id/search', (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const matches = searchProjectCode(req.params.id, q);
      res.json({ ok: true, matches });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка поиска по коду' });
    }
  });

  app.post('/api/projects/:id/exec', async (req, res) => {
    try {
      const command = typeof req.body?.command === 'string' ? req.body.command : '';
      const timeoutMs = typeof req.body?.timeoutMs === 'number' ? req.body.timeoutMs : 30000;
      const result = await execProjectCommand(req.params.id, command, timeoutMs);
      res.json({ ok: result.exitCode === 0, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка выполнения команды' });
    }
  });

  app.post('/api/projects/:id/git', async (req, res) => {
    try {
      const action = req.body?.action;
      const commitMessage = typeof req.body?.message === 'string' ? req.body.message : undefined;
      const result = await runProjectGit(req.params.id, action, commitMessage);
      res.json({ ok: result.exitCode === 0, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка git' });
    }
  });

  app.get('/api/projects/:id/logs', (req, res) => {
    try {
      const logs = readProjectActionLog(req.params.id);
      res.json({ ok: true, logs });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка чтения лога' });
    }
  });

  app.post('/api/projects/:id/undo', (req, res) => {
    try {
      const result = undoLastProjectAction(req.params.id);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(400).json({ ok: false, message: err instanceof Error ? err.message : 'Ошибка отката' });
    }
  });

  app.post('/api/projects/:id/task', async (req, res) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
      const mode = req.body?.mode === 'plan' ? 'plan' : 'act';
      const provider = req.body?.provider;
      const result = await executeProjectTask({
        projectId: req.params.id,
        prompt,
        mode,
        provider,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Ошибка выполнения задачи' });
    }
  });

  // =========================================================================
  // 6. Real SSH Host Test (§4.2) & GitHub Verification
  // =========================================================================
  app.post('/api/ssh/test', async (req, res) => {
    const result = await verifySshConnectionAndPath({
      host: String(req.body?.hostName || req.body?.host || ''),
      port: Number(req.body?.port || 22),
      user: String(req.body?.user || ''),
      remotePath: String(req.body?.remotePath || '/tmp'),
      authType: req.body?.authType || 'key',
      keyPath: typeof req.body?.identityFile === 'string' ? req.body.identityFile : undefined,
    });
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.get('/install.ps1', async (_req, res) => {
    try {
      const scriptPath = path.resolve(rootDir, 'scripts', 'install.ps1');
      const content = fs.readFileSync(scriptPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="install-kova-studio.ps1"');
      res.send(content);
    } catch {
      res.status(404).send('# install.ps1 not found');
    }
  });

  app.post('/api/github/verify', async (req, res) => {
    const rawRepo = typeof req.body?.repo === 'string' ? req.body.repo.trim() : '';
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

    const cleanRepo = rawRepo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    if (!cleanRepo || !cleanRepo.includes('/')) {
      res.status(400).json({ ok: false, error: 'Укажите репозиторий в формате owner/repo' });
      return;
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'KovaStudio/1.0',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);

      let authUser: string | null = null;
      let grantedScopes: string[] = [];

      if (token) {
        const userResp = await fetch('https://api.github.com/user', { headers, signal: controller.signal });
        if (!userResp.ok) {
          clearTimeout(timeout);
          res.status(userResp.status).json({
            ok: false,
            error: `Токен отклонён GitHub API (HTTP ${userResp.status})`,
          });
          return;
        }
        const userData = (await userResp.json()) as { login?: string };
        authUser = userData.login ?? null;
        const rawScopes = userResp.headers.get('x-oauth-scopes') || '';
        grantedScopes = rawScopes.split(',').map((s) => s.trim()).filter(Boolean);
      }

      const [owner, repoName] = cleanRepo.split('/');
      const repoResp = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
        { headers, signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!repoResp.ok) {
        res.status(repoResp.status).json({
          ok: false,
          authUser,
          grantedScopes,
          error:
            repoResp.status === 404
              ? `Репозиторий ${cleanRepo} не найден или приватный (нужен токен / SSH)`
              : `GitHub API вернул HTTP ${repoResp.status}`,
        });
        return;
      }

      const repoData = (await repoResp.json()) as {
        full_name?: string;
        private?: boolean;
        default_branch?: string;
        stargazers_count?: number;
      };

      res.json({
        ok: true,
        authUser,
        grantedScopes,
        repo: {
          fullName: repoData.full_name ?? cleanRepo,
          isPrivate: Boolean(repoData.private),
          defaultBranch: repoData.default_branch ?? 'main',
          stars: repoData.stargazers_count ?? 0,
        },
      });
    } catch (err) {
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  });

  // =========================================================================
  // 7. Free AI Providers Proxy & Telegram Bot Verify
  // =========================================================================
  app.post('/api/providers/models', async (req, res) => {
    const kind = typeof req.body?.kind === 'string' ? req.body.kind : 'custom';
    const rawBaseUrl = typeof req.body?.baseUrl === 'string' ? req.body.baseUrl.trim() : '';
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

    if (!rawBaseUrl) {
      res.status(400).json({ ok: false, error: 'Не указан baseUrl провайдера', models: [] });
      return;
    }

    const cleanBase = rawBaseUrl.replace(/\/+$/, '');
    const modelsEndpoint = `${cleanBase}/models`;
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'KovaStudio/1.0' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);
      const response = await fetch(modelsEndpoint, { headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(response.status).json({
          ok: false,
          error: `Провайдер вернул HTTP ${response.status} на ${modelsEndpoint}`,
          models: [],
        });
        return;
      }

      const data = (await response.json()) as {
        data?: Array<{ id?: string; pricing?: { prompt?: string; completion?: string } }>;
      };
      let list = (data.data ?? []).filter((m) => Boolean(m.id));
      if (kind === 'openrouter-free') {
        list = list.filter(
          (m) => m.id?.endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0'),
        );
      }
      const modelIds = list.map((m) => m.id as string).filter(Boolean).slice(0, 60);
      res.json({ ok: true, count: modelIds.length, models: modelIds });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Сервер провайдера недоступен';
      res.status(502).json({
        ok: false,
        error:
          msg.includes('fetch failed') || msg.includes('ECONNREFUSED')
            ? `Локальный сервер ${cleanBase} сейчас не запущен на этом хосте`
            : msg,
        models: [],
      });
    }
  });

  app.post('/api/providers/chat', async (req, res) => {
    const rawBaseUrl = typeof req.body?.baseUrl === 'string' ? req.body.baseUrl.trim() : '';
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const temperature = typeof req.body?.temperature === 'number' ? req.body.temperature : 0.2;

    if (!rawBaseUrl || !model || messages.length === 0) {
      res.status(400).json({ ok: false, error: 'Не заданы baseUrl, model или messages' });
      return;
    }

    const cleanBase = rawBaseUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'HTTP-Referer': 'https://github.com/alexpikman/Kova-Studio',
      'X-Title': 'Kova Studio',
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(`${cleanBase}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, temperature, stream: false }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        res.status(response.status).json({
          ok: false,
          error: text.slice(0, 300) || `HTTP ${response.status}`,
        });
        return;
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: { total_tokens?: number };
      };
      res.json({
        ok: true,
        content: json.choices?.[0]?.message?.content ?? '',
        model: json.model ?? model,
        totalTokens: json.usage?.total_tokens ?? 0,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        localOffline: true,
        error: err instanceof Error ? err.message : 'Network error',
      });
    }
  });

  app.post('/api/gateway/telegram/verify', async (req, res) => {
    const token = typeof req.body?.botToken === 'string' ? req.body.botToken.trim() : '';
    if (!token || !token.includes(':')) {
      res.status(400).json({ ok: false, error: 'Укажите корректный Telegram Bot Token вида 123456:ABC...' });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = (await response.json()) as {
        ok?: boolean;
        description?: string;
        result?: { id?: number; username?: string; first_name?: string };
      };

      if (!response.ok || !json.ok || !json.result) {
        res.status(400).json({
          ok: false,
          error: json.description || `Telegram API вернул HTTP ${response.status}`,
        });
        return;
      }

      res.json({
        ok: true,
        botId: json.result.id,
        username: json.result.username,
        firstName: json.result.first_name,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Ошибка соединения с api.telegram.org',
      });
    }
  });

  return app;
}
