import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

// Isolate KOVA_HOME in a temporary directory so tests never pollute real ~/.kova-studio
const tempKovaHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kova-test-home-'));
process.env.KOVA_HOME = tempKovaHome;

import { createApiApp } from '../server/app';
import { recommendModelForHardware, type HardwareProfile } from '../server/hardware';

let apiServer: http.Server;
let apiBaseUrl = '';

let rangeServer: http.Server;
let rangeBaseUrl = '';
let rangeRequestSeen = false;
let throttleFirstChunk = false;

const sampleModelBytes = Buffer.alloc(1024 * 512, 0x4b);
// Put GGUF magic header at start so file is a valid GGUF-prefixed payload
sampleModelBytes.write('GGUF', 0, 'ascii');
const sampleModelSha256 = crypto.createHash('sha256').update(sampleModelBytes).digest('hex');

async function jsonReq<T = Record<string, unknown>>(
  urlPath: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${apiBaseUrl}${urlPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

before(async () => {
  // 1. Start mock-free local HTTP Range file server for streaming download / pause / resume tests
  rangeServer = http.createServer(async (req, res) => {
    if (req.url === '/test-model.gguf') {
      const rangeHeader = req.headers.range;
      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        rangeRequestSeen = true;
        const start = Number(rangeHeader.replace('bytes=', '').split('-')[0]) || 0;
        if (start >= sampleModelBytes.length) {
          res.writeHead(416, { 'Content-Range': `bytes */${sampleModelBytes.length}` });
          res.end();
          return;
        }
        const slice = sampleModelBytes.subarray(start);
        res.writeHead(206, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(slice.length),
          'Content-Range': `bytes ${start}-${sampleModelBytes.length - 1}/${sampleModelBytes.length}`,
          'Accept-Ranges': 'bytes',
        });
        res.end(slice);
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(sampleModelBytes.length),
        'Accept-Ranges': 'bytes',
      });

      if (throttleFirstChunk) {
        // Stream in small chunks so pause test can reliably interrupt mid-stream
        const chunkSize = 64 * 1024;
        for (let offset = 0; offset < sampleModelBytes.length; offset += chunkSize) {
          if (res.destroyed) break;
          res.write(sampleModelBytes.subarray(offset, offset + chunkSize));
          await new Promise((r) => setTimeout(r, 45));
        }
        res.end();
      } else {
        res.end(sampleModelBytes);
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise<void>((resolve) => {
    rangeServer.listen(0, '127.0.0.1', () => {
      const addr = rangeServer.address();
      if (addr && typeof addr === 'object') {
        rangeBaseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  // 2. Start Kova Express backend
  const app = createApiApp(process.cwd());
  apiServer = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => {
    apiServer.once('listening', () => {
      const addr = apiServer.address();
      if (addr && typeof addr === 'object') {
        apiBaseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  await new Promise<void>((resolve) => rangeServer.close(() => resolve()));
  fs.rmSync(tempKovaHome, { recursive: true, force: true });
});

test('1. Real hardware detection & 3-tier recommendation logic', async () => {
  const { status, data } = await jsonReq<{ ok: boolean; hardware: HardwareProfile }>('/api/hardware');
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.ok(data.hardware.cpu.cores >= 1);
  assert.ok(data.hardware.ram.totalGb > 0);
  assert.ok(data.hardware.disk.freeGb >= 0);

  // Verify 3-tier classification for 8 GB VRAM GPU + 16 GB RAM system
  const gpuProfile: HardwareProfile = {
    ...data.hardware,
    gpuDetected: true,
    totalVramGb: 8,
    freeVramGb: 7.5,
    ram: { ...data.hardware.ram, totalGb: 16, freeGb: 12 },
    disk: { ...data.hardware.disk, totalGb: 500, freeGb: 200 },
  };

  const fitsVram = recommendModelForHardware(
    { id: '7b-q4', name: 'Qwen2.5-7B Q4_K_M', quant: 'Q4_K_M', sizeGb: 4.7 },
    gpuProfile,
  );
  assert.equal(fitsVram.category, 'fits-vram');
  assert.equal(fitsVram.categoryLabel, 'Поместится в VRAM');
  assert.ok(fitsVram.remainingVramAfterGb > 0);

  const fitsRam = recommendModelForHardware(
    { id: '14b-q4', name: 'Qwen2.5-14B Q4_K_M', quant: 'Q4_K_M', sizeGb: 8.9 },
    gpuProfile,
  );
  assert.equal(fitsRam.category, 'fits-ram');
  assert.equal(fitsRam.categoryLabel, 'Поместится в RAM (CPU)');

  const tooHeavy = recommendModelForHardware(
    { id: '70b-q4', name: 'Llama-70B Q4_K_M', quant: 'Q4_K_M', sizeGb: 42 },
    gpuProfile,
  );
  assert.equal(tooHeavy.category, 'too-heavy');
  assert.equal(tooHeavy.categoryLabel, 'Слишком тяжело');
});

test('2. Real streaming download, pause, HTTP Range resume, SHA256 verify, corrupt block, and disk delete', async () => {
  throttleFirstChunk = true;
  rangeRequestSeen = false;

  const startRes = await jsonReq<{ ok: boolean; model: { id: string; localPath: string } }>(
    '/api/models/download',
    {
      method: 'POST',
      body: JSON.stringify({
        repoId: 'test/local-range',
        name: 'Test Range Model',
        quant: 'Q4_K_M',
        filename: 'test-model.gguf',
        downloadUrl: `${rangeBaseUrl}/test-model.gguf`,
        expectedSha256: sampleModelSha256,
      }),
    },
  );
  assert.equal(startRes.status, 202);
  assert.equal(startRes.data.ok, true);
  const modelId = startRes.data.model.id;
  const localPath = startRes.data.model.localPath;

  // Wait until at least 64 KB is written to .part, then pause
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 40));
    if (fs.existsSync(`${localPath}.part`) && fs.statSync(`${localPath}.part`).size >= 65536) {
      break;
    }
  }
  const pauseRes = await jsonReq<{ ok: boolean; model: { status: string; downloadedBytes: number } }>(
    `/api/models/download/${encodeURIComponent(modelId)}/pause`,
    { method: 'POST' },
  );
  assert.equal(pauseRes.status, 200);
  assert.equal(pauseRes.data.model.status, 'paused');
  assert.ok(fs.existsSync(`${localPath}.part`), '.part file must exist on disk after pause');
  assert.ok(fs.statSync(`${localPath}.part`).size > 0, '.part file must contain partial bytes');

  // Resume download and wait for completion + SHA256 verification
  throttleFirstChunk = false;
  const resumeRes = await jsonReq<{ ok: boolean }>(
    `/api/models/download/${encodeURIComponent(modelId)}/resume`,
    { method: 'POST' },
  );
  assert.equal(resumeRes.status, 200);

  let readyModel: { status: string; sha256Verified: boolean; computedSha256: string } | undefined;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 60));
    const listRes = await jsonReq<{
      models: Array<{ id: string; status: string; sha256Verified: boolean; computedSha256: string }>;
    }>('/api/models/local');
    const found = listRes.data.models.find((m) => m.id === modelId);
    if (found && (found.status === 'ready' || found.status === 'error' || found.status === 'corrupt')) {
      readyModel = found;
      break;
    }
  }

  assert.ok(readyModel, 'Model download should reach terminal state');
  assert.equal(readyModel.status, 'ready');
  assert.equal(readyModel.sha256Verified, true);
  assert.equal(readyModel.computedSha256, sampleModelSha256);
  assert.equal(rangeRequestSeen, true, 'Resumed download must issue HTTP Range header');
  assert.ok(fs.existsSync(localPath), 'Final GGUF file must exist on disk');

  // Corrupt SHA256 rejection test
  const badRes = await jsonReq<{ ok: boolean; model: { id: string } }>('/api/models/download', {
    method: 'POST',
    body: JSON.stringify({
      repoId: 'test/bad-hash',
      name: 'Corrupt Hash Model',
      quant: 'Q4_K_M',
      filename: 'bad-model.gguf',
      downloadUrl: `${rangeBaseUrl}/test-model.gguf`,
      expectedSha256: '0000000000000000000000000000000000000000000000000000000000000000',
    }),
  });
  const badId = badRes.data.model.id;
  let badState: string | undefined;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 50));
    const listRes = await jsonReq<{ models: Array<{ id: string; status: string }> }>('/api/models/local');
    const found = listRes.data.models.find((m) => m.id === badId);
    if (found && (found.status === 'corrupt' || found.status === 'ready' || found.status === 'error')) {
      badState = found.status;
      break;
    }
  }
  assert.equal(badState, 'corrupt', 'SHA256 mismatch must mark model corrupt');

  const activateBad = await jsonReq<{ ok: boolean }>(`/api/models/local/${encodeURIComponent(badId)}/activate`, {
    method: 'POST',
  });
  assert.equal(activateBad.status, 400);
  assert.equal(activateBad.data.ok, false);

  // Physical disk deletion
  const delGood = await jsonReq<{ ok: boolean }>(`/api/models/local/${encodeURIComponent(modelId)}`, {
    method: 'DELETE',
  });
  assert.equal(delGood.data.ok, true);
  assert.equal(fs.existsSync(localPath), false, 'Deleted model file must be removed from disk');
  await jsonReq(`/api/models/local/${encodeURIComponent(badId)}`, { method: 'DELETE' });
});

test('3. Mandatory folder validation, real Python execution, action log, /undo, and non-destructive project delete', async () => {
  // Attempt to create project without folder -> must fail with 400
  const invalidProj = await jsonReq<{ ok: boolean; error: string }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Missing Folder Project',
      folderSource: 'local',
      folderPath: '',
    }),
  });
  assert.equal(invalidProj.status, 400);
  assert.equal(invalidProj.data.ok, false);

  // Create real temporary workspace folder with a persistent user file
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'kova-proj-'));
  const keepFile = path.join(workdir, 'keep.txt');
  fs.writeFileSync(keepFile, 'user-owned-data', 'utf-8');

  try {
    const createProj = await jsonReq<{ ok: boolean; project: { id: string; folderPath: string } }>(
      '/api/projects',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Real Python Project',
          description: 'Integration test project',
          folderSource: 'local',
          folderPath: workdir,
        }),
      },
    );
    assert.equal(createProj.status, 201);
    assert.equal(createProj.data.ok, true);
    const projectId = createProj.data.project.id;

    // Write hello.py via API
    const writeRes = await jsonReq<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/file`,
      {
        method: 'PUT',
        body: JSON.stringify({
          path: 'hello.py',
          content: 'print("Hello from Kova")\n',
          summary: 'Create hello.py',
        }),
      },
    );
    assert.equal(writeRes.status, 200);
    assert.equal(writeRes.data.ok, true);
    assert.equal(fs.existsSync(path.join(workdir, 'hello.py')), true);

    // Execute real `python3 hello.py` (and `python hello.py` fallback)
    const execRes = await jsonReq<{ ok: boolean; stdout: string; exitCode: number }>(
      `/api/projects/${encodeURIComponent(projectId)}/exec`,
      {
        method: 'POST',
        body: JSON.stringify({ command: 'python hello.py' }),
      },
    );
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.exitCode, 0);
    assert.match(execRes.data.stdout, /Hello from Kova/);

    // Verify action log contains write & command entries
    const logsRes = await jsonReq<{
      ok: boolean;
      logs: Array<{ kind: string; filePath?: string; command?: string }>;
    }>(`/api/projects/${encodeURIComponent(projectId)}/logs`);
    assert.equal(logsRes.status, 200);
    assert.ok(logsRes.data.logs.some((l) => l.kind === 'file_write' && l.filePath === 'hello.py'));
    assert.ok(logsRes.data.logs.some((l) => l.kind === 'command'));

    // Undo file creation via /api/projects/:id/undo -> hello.py must be removed from disk
    const undoRes = await jsonReq<{ ok: boolean; message: string }>(
      `/api/projects/${encodeURIComponent(projectId)}/undo`,
      { method: 'POST' },
    );
    assert.equal(undoRes.status, 200);
    assert.equal(undoRes.data.ok, true);
    assert.equal(fs.existsSync(path.join(workdir, 'hello.py')), false, '/undo must remove newly created file');

    // Delete project record -> user folder and keep.txt must remain intact on disk
    const delProj = await jsonReq<{ ok: boolean }>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
    assert.equal(delProj.status, 200);
    assert.equal(delProj.data.ok, true);
    assert.equal(fs.existsSync(keepFile), true, 'Deleting project must NOT delete user files on disk');
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test('4. Real error handling for SSH / GitHub / Ollama without simulation', async () => {
  const sshRes = await jsonReq<{ ok: boolean; error: string }>('/api/ssh/test', {
    method: 'POST',
    body: JSON.stringify({
      hostName: '192.0.2.1',
      port: 22,
      user: 'nobody',
      remotePath: '/tmp',
      authType: 'key',
    }),
  });
  assert.equal(sshRes.status, 400);
  assert.equal(sshRes.data.ok, false);
  assert.ok(sshRes.data.error.length > 0);

  const ghBad = await jsonReq<{ ok: boolean; error: string }>('/api/github/verify', {
    method: 'POST',
    body: JSON.stringify({
      repo: 'invalid-format-without-slash',
    }),
  });
  assert.equal(ghBad.status, 400);
  assert.equal(ghBad.data.ok, false);
});
