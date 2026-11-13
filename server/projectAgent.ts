import { execFile, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { ensureKovaDirs } from './paths';
import { getProjectById, type ProjectRecord } from './projectsManager';

const execFileAsync = promisify(execFile);

export interface RealProjectFileInfo {
  path: string;
  name: string;
  folder: string;
  language: string;
  sizeBytes: number;
  tokensEstimate: number;
  content?: string;
}

export interface ProjectActionLogEntry {
  id: string;
  projectId: string;
  timestamp: string;
  kind: 'file_write' | 'command' | 'git' | 'undo' | 'task';
  summary: string;
  filePath?: string;
  existedBefore?: boolean;
  previousContent?: string | null;
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  undone?: boolean;
}

export interface ExecCommandResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  '.next',
  '.turbo',
  '__pycache__',
  '.venv',
]);

function getLogFilePath(projectId: string): string {
  const { logsDir } = ensureKovaDirs();
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return path.join(logsDir, `${safeId}.json`);
}

export function readProjectActionLog(projectId: string): ProjectActionLogEntry[] {
  const p = getLogFilePath(projectId);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProjectActionLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeProjectActionLog(projectId: string, entries: ProjectActionLogEntry[]): void {
  const p = getLogFilePath(projectId);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(entries.slice(0, 200), null, 2), 'utf-8');
  fs.renameSync(tmp, p);
}

function appendActionLog(entry: Omit<ProjectActionLogEntry, 'id' | 'timestamp'>): ProjectActionLogEntry {
  const list = readProjectActionLog(entry.projectId);
  const full: ProjectActionLogEntry = {
    ...entry,
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  list.unshift(full);
  writeProjectActionLog(entry.projectId, list);
  return full;
}

export function safeResolveInside(projectRoot: string, relPath: string): string {
  const cleanRel = relPath.trim().replace(/^[/\\]+/, '');
  const rootResolved = fs.realpathSync(path.resolve(projectRoot));
  const target = path.resolve(rootResolved, cleanRel);
  if (target !== rootResolved && !target.startsWith(`${rootResolved}${path.sep}`)) {
    throw new Error(`Доступ за пределы папки проекта запрещён: ${relPath}`);
  }
  return target;
}

function inferLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.rs':
      return 'rust';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
      return 'javascript';
    case '.py':
      return 'python';
    case '.toml':
      return 'toml';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    case '.sh':
    case '.ps1':
      return 'shell';
    default:
      return 'text';
  }
}

function requireLocalProject(projectId: string): ProjectRecord {
  const project = getProjectById(projectId);
  if (!project) {
    throw new Error(`Проект ${projectId} не найден`);
  }
  if (!project.folderPath || !fs.existsSync(project.folderPath)) {
    throw new Error(`Папка проекта недоступна: ${project.folderPath}`);
  }
  return project;
}

export function listProjectFiles(projectId: string, maxFiles = 200): RealProjectFileInfo[] {
  const project = requireLocalProject(projectId);
  const root = path.resolve(project.folderPath);
  const results: RealProjectFileInfo[] = [];

  function walk(dir: string): void {
    if (results.length >= maxFiles) return;
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    items.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      if (results.length >= maxFiles) break;
      if (item.isDirectory()) {
        if (IGNORED_DIRS.has(item.name)) continue;
        walk(path.join(dir, item.name));
      } else if (item.isFile()) {
        const full = path.join(dir, item.name);
        const rel = path.relative(root, full).split(path.sep).join('/');
        const folderRel = path.posix.dirname(rel);
        let sizeBytes = 0;
        try {
          sizeBytes = fs.statSync(full).size;
        } catch {
          sizeBytes = 0;
        }
        results.push({
          path: rel,
          name: item.name,
          folder: folderRel === '.' ? '/' : folderRel,
          language: inferLanguage(item.name),
          sizeBytes,
          tokensEstimate: Math.max(1, Math.round(sizeBytes / 4)),
        });
      }
    }
  }

  walk(root);
  return results;
}

export function readProjectFile(projectId: string, relPath: string): { path: string; content: string; sizeBytes: number } {
  const project = requireLocalProject(projectId);
  const full = safeResolveInside(project.folderPath, relPath);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    throw new Error(`Файл не найден в проекте: ${relPath}`);
  }
  const stat = fs.statSync(full);
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`Файл слишком большой для чтения в контекст (${stat.size} байт)`);
  }
  const content = fs.readFileSync(full, 'utf-8');
  return {
    path: path.relative(project.folderPath, full).split(path.sep).join('/'),
    content,
    sizeBytes: stat.size,
  };
}

export function writeProjectFile(
  projectId: string,
  relPath: string,
  newContent: string,
  summary = 'Обновление файла',
): { path: string; existedBefore: boolean; logEntry: ProjectActionLogEntry } {
  const project = requireLocalProject(projectId);
  const full = safeResolveInside(project.folderPath, relPath);
  const normalizedRel = path.relative(path.resolve(project.folderPath), full).split(path.sep).join('/');

  const existedBefore = fs.existsSync(full) && fs.statSync(full).isFile();
  const previousContent = existedBefore ? fs.readFileSync(full, 'utf-8') : null;

  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, newContent, 'utf-8');

  const logEntry = appendActionLog({
    projectId,
    kind: 'file_write',
    summary: `${summary}: ${normalizedRel}`,
    filePath: normalizedRel,
    existedBefore,
    previousContent,
    undone: false,
  });

  return {
    path: normalizedRel,
    existedBefore,
    logEntry,
  };
}

export function undoLastProjectAction(projectId: string): {
  ok: boolean;
  message: string;
  restoredFile?: string;
  action?: 'restored' | 'deleted';
} {
  const project = requireLocalProject(projectId);
  const log = readProjectActionLog(projectId);
  const target = log.find((entry) => entry.kind === 'file_write' && !entry.undone && entry.filePath);

  if (!target || !target.filePath) {
    return {
      ok: false,
      message: 'Нет активных изменений файлов для отката (/undo).',
    };
  }

  const full = safeResolveInside(project.folderPath, target.filePath);
  let action: 'restored' | 'deleted';

  if (target.existedBefore && target.previousContent !== null && target.previousContent !== undefined) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, target.previousContent, 'utf-8');
    action = 'restored';
  } else {
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
    }
    action = 'deleted';
  }

  target.undone = true;
  writeProjectActionLog(projectId, log);

  appendActionLog({
    projectId,
    kind: 'undo',
    summary:
      action === 'deleted'
        ? `/undo: удалён созданный файл ${target.filePath}`
        : `/undo: восстановлено прежнее содержимое ${target.filePath}`,
    filePath: target.filePath,
  });

  return {
    ok: true,
    restoredFile: target.filePath,
    action,
    message:
      action === 'deleted'
        ? `Откат выполнен: файл ${target.filePath} удалён с диска.`
        : `Откат выполнен: восстановлено прежнее содержимое ${target.filePath}.`,
  };
}

export function searchProjectCode(
  projectId: string,
  query: string,
): Array<{ path: string; line: number; text: string }> {
  const q = query.trim();
  if (!q) return [];
  const files = listProjectFiles(projectId, 250);
  const matches: Array<{ path: string; line: number; text: string }> = [];
  const qLower = q.toLowerCase();

  for (const file of files) {
    if (file.sizeBytes > 512 * 1024) continue;
    try {
      const { content } = readProjectFile(projectId, file.path);
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(qLower)) {
          matches.push({
            path: file.path,
            line: i + 1,
            text: lines[i].trim().slice(0, 180),
          });
          if (matches.length >= 60) return matches;
        }
      }
    } catch {
      // skip binary or unreadable files
    }
  }
  return matches;
}

let cachedHasPython: boolean | null = null;
async function normalizeCommandForPlatform(rawCommand: string): Promise<string> {
  if (os.platform() === 'win32') return rawCommand;
  // On Linux/macOS where `python` may not exist while `python3` does, map leading `python ` -> `python3 `
  if (/^\s*python(?:\s|$)/.test(rawCommand)) {
    if (cachedHasPython === null) {
      try {
        await execFileAsync('which', ['python']);
        cachedHasPython = true;
      } catch {
        cachedHasPython = false;
      }
    }
    if (!cachedHasPython) {
      return rawCommand.replace(/^(\s*)python(?=\s|$)/, '$1python3');
    }
  }
  return rawCommand;
}

export async function execProjectCommand(
  projectId: string,
  commandInput: string,
  timeoutMs = 30000,
): Promise<ExecCommandResult> {
  const project = requireLocalProject(projectId);
  const raw = commandInput.trim();
  if (!raw) {
    throw new Error('Пустая команда для выполнения');
  }

  const command = await normalizeCommandForPlatform(raw);
  const cwd = path.resolve(project.folderPath);
  const start = Date.now();

  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const shellBin = isWin ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWin ? ['-NoProfile', '-Command', command] : ['-c', command];

    const child = spawn(shellBin, shellArgs, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < 128 * 1024) stdout += chunk.toString('utf-8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < 128 * 1024) stderr += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      const result: ExecCommandResult = {
        command,
        cwd,
        stdout,
        stderr: `${stderr}\n${err.message}`.trim(),
        exitCode: 127,
        durationMs: Date.now() - start,
        timedOut,
      };
      appendActionLog({
        projectId,
        kind: 'command',
        summary: `Команда завершилась с ошибкой: ${command}`,
        command,
        exitCode: result.exitCode,
        stdout: result.stdout.slice(0, 1000),
        stderr: result.stderr.slice(0, 1000),
      });
      resolve(result);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const exitCode = timedOut ? 124 : code ?? 1;
      const result: ExecCommandResult = {
        command,
        cwd,
        stdout: stdout.trimEnd(),
        stderr: timedOut ? `${stderr}\nТаймаут выполнения (${timeoutMs} мс)`.trim() : stderr.trimEnd(),
        exitCode,
        durationMs: Date.now() - start,
        timedOut,
      };
      appendActionLog({
        projectId,
        kind: 'command',
        summary: `Выполнено (${exitCode}): ${command}`,
        command,
        exitCode,
        stdout: result.stdout.slice(0, 1000),
        stderr: result.stderr.slice(0, 1000),
      });
      resolve(result);
    });
  });
}

export async function runProjectGit(
  projectId: string,
  action: 'status' | 'diff' | 'log' | 'commit' | 'fetch' | 'push' | 'init',
  commitMessage?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const project = requireLocalProject(projectId);
  const cwd = path.resolve(project.folderPath);

  let args: string[] = [];
  if (action === 'init') {
    args = ['init'];
  } else if (action === 'status') {
    args = ['status', '--short', '--branch'];
  } else if (action === 'diff') {
    args = ['diff', '--stat'];
  } else if (action === 'log') {
    args = ['log', '-n', '10', '--oneline'];
  } else if (action === 'fetch') {
    args = ['fetch', '--all'];
  } else if (action === 'push') {
    args = ['push'];
  } else if (action === 'commit') {
    const msg = commitMessage?.trim() || 'Kova Studio commit';
    await execFileAsync('git', ['-C', cwd, 'add', '-A']);
    args = ['commit', '-m', msg];
  }

  try {
    const { stdout, stderr } = await execFileAsync('git', ['-C', cwd, ...args], { timeout: 25000 });
    appendActionLog({
      projectId,
      kind: 'git',
      summary: `git ${args[0]}`,
      command: `git ${args.join(' ')}`,
      exitCode: 0,
      stdout: stdout.slice(0, 1000),
      stderr: stderr.slice(0, 1000),
    });
    return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    const exitCode = typeof e.code === 'number' ? e.code : 1;
    const stderr = (e.stderr || e.message || 'Ошибка git').trim();
    const stdout = (e.stdout || '').trim();
    appendActionLog({
      projectId,
      kind: 'git',
      summary: `git ${args[0]} (код ${exitCode})`,
      command: `git ${args.join(' ')}`,
      exitCode,
      stdout: stdout.slice(0, 1000),
      stderr: stderr.slice(0, 1000),
    });
    return { stdout, stderr, exitCode };
  }
}

export async function executeProjectTask(input: {
  projectId: string;
  prompt: string;
  mode: 'plan' | 'act';
  provider?: {
    baseUrl: string;
    apiKey?: string;
    model: string;
    temperature?: number;
    systemPrompt?: string;
  };
}): Promise<{
  replyText: string;
  readFiles: string[];
  commandResult?: ExecCommandResult;
  proposedCommand?: string;
  diff?: { filePath: string; oldContent: string; newContent: string; summary: string };
  usedLiveLlm: boolean;
}> {
  const project = requireLocalProject(input.projectId);
  const prompt = input.prompt.trim();

  if (prompt === '/undo') {
    const undone = undoLastProjectAction(project.id);
    return {
      replyText: undone.message,
      readFiles: undone.restoredFile ? [undone.restoredFile] : [],
      usedLiveLlm: false,
    };
  }

  const projectFiles = listProjectFiles(project.id, 60);
  const readFilesList = projectFiles.slice(0, 5).map((f) => f.path);
  const snippets: string[] = [];
  for (const rel of readFilesList) {
    try {
      const f = readProjectFile(project.id, rel);
      snippets.push(`### ${f.path}\n\`\`\`\n${f.content.slice(0, 1200)}\n\`\`\``);
    } catch {
      // ignore
    }
  }

  // Handle explicit terminal execution prefix: /run <cmd>
  if (prompt.startsWith('/run ')) {
    const cmd = prompt.slice(5).trim();
    if (input.mode === 'plan') {
      return {
        replyText: `Режим **Plan**: команда \`${cmd}\` не запускалась автоматически. Переключите режим на **Act** или подтвердите запуск ниже.`,
        readFiles: readFilesList,
        proposedCommand: cmd,
        usedLiveLlm: false,
      };
    }
    const execRes = await execProjectCommand(project.id, cmd);
    return {
      replyText: `Команда \`${execRes.command}\` выполнена в \`${execRes.cwd}\` с кодом **${execRes.exitCode}** (${execRes.durationMs} мс).`,
      readFiles: [],
      commandResult: execRes,
      usedLiveLlm: false,
    };
  }

  // Handle explicit /git <status|diff|log|fetch>
  if (prompt.startsWith('/git')) {
    const sub = prompt.slice(4).trim().split(/\s+/)[0] || 'status';
    const valid = ['status', 'diff', 'log', 'fetch', 'push'].includes(sub)
      ? (sub as 'status' | 'diff' | 'log' | 'fetch' | 'push')
      : 'status';
    const gitRes = await runProjectGit(project.id, valid);
    return {
      replyText: `Результат \`git ${valid}\` (код ${gitRes.exitCode}):\n\`\`\`\n${gitRes.stdout || gitRes.stderr || '(пустой вывод)'}\n\`\`\``,
      readFiles: [],
      usedLiveLlm: false,
    };
  }

  // Handle explicit /search <query>
  if (prompt.startsWith('/search ')) {
    const q = prompt.slice(8).trim();
    const hits = searchProjectCode(project.id, q);
    const body =
      hits.length === 0
        ? `Совпадений для \`${q}\` в папке \`${project.folderPath}\` не найдено.`
        : hits
            .slice(0, 15)
            .map((h) => `- \`${h.path}:${h.line}\` — ${h.text}`)
            .join('\n');
    return {
      replyText: `Поиск по коду (\`${q}\`, найдено: ${hits.length}):\n${body}`,
      readFiles: Array.from(new Set(hits.map((h) => h.path))),
      usedLiveLlm: false,
    };
  }

  // Try live LLM provider when configured with a reachable endpoint / API key
  if (input.provider?.baseUrl && input.provider?.model) {
    const base = input.provider.baseUrl.replace(/\/+$/, '');
    const sys = [
      input.provider.systemPrompt || 'Ты инженерный агент Kova Studio.',
      `Текущий проект: ${project.name} (${project.folderPath}). Режим: ${input.mode.toUpperCase()}.`,
      `Файлы в папке проекта (${projectFiles.length}): ${projectFiles.map((f) => f.path).join(', ') || '(папка пуста)'}.`,
      snippets.length > 0 ? `Содержимое первых файлов:\n${snippets.join('\n\n')}` : '',
      input.mode === 'act'
        ? `Если для решения задачи нужно создать/изменить файл и/или выполнить команду, верни ТОЛЬКО JSON-объект (или markdown + JSON-блок \`\`\`kova-action ... \`\`\`) вида: {"reply":"...","writeFile":{"path":"rel/path","content":"...","summary":"..."},"runCommand":"..."}`
        : 'Ты в режиме Plan: проанализируй реальные файлы проекта и предложи точный план без изменения файлов.',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (input.provider.apiKey?.trim()) {
        headers.Authorization = `Bearer ${input.provider.apiKey.trim()}`;
      }

      const resp = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: input.provider.model,
          temperature: input.provider.temperature ?? 0.2,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: prompt },
          ],
          stream: false,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (resp.ok) {
        const json = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const rawContent = json.choices?.[0]?.message?.content?.trim() || '';
        if (rawContent) {
          // Check if LLM returned structured kova-action
          const actionMatch = rawContent.match(/```kova-action\s*([\s\S]*?)```/);
          const jsonCandidate = actionMatch ? actionMatch[1].trim() : rawContent.startsWith('{') ? rawContent : null;

          let diff: { filePath: string; oldContent: string; newContent: string; summary: string } | undefined;
          let commandResult: ExecCommandResult | undefined;
          let replyText = rawContent;

          if (jsonCandidate && input.mode === 'act') {
            try {
              const parsed = JSON.parse(jsonCandidate) as {
                reply?: string;
                writeFile?: { path: string; content: string; summary?: string };
                runCommand?: string;
              };
              if (parsed.reply) replyText = parsed.reply;
              if (parsed.writeFile?.path && typeof parsed.writeFile.content === 'string') {
                const full = safeResolveInside(project.folderPath, parsed.writeFile.path);
                const oldContent = fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
                writeProjectFile(
                  project.id,
                  parsed.writeFile.path,
                  parsed.writeFile.content,
                  parsed.writeFile.summary || 'Правка от ИИ-агента',
                );
                diff = {
                  filePath: parsed.writeFile.path,
                  oldContent,
                  newContent: parsed.writeFile.content,
                  summary: parsed.writeFile.summary || 'Правка от ИИ-агента',
                };
              }
              if (parsed.runCommand?.trim()) {
                commandResult = await execProjectCommand(project.id, parsed.runCommand.trim());
              }
            } catch {
              // keep raw markdown reply
            }
          }

          return {
            replyText,
            readFiles: readFilesList,
            diff,
            commandResult,
            usedLiveLlm: true,
          };
        }
      }
    } catch {
      // Fall through to deterministic local inspection report (honest reporting, no fake LLM output)
    }
  }

  // Without a running LLM server, inspect the REAL project directory honestly and report what exists + real commands
  const filesSummary =
    projectFiles.length === 0
      ? `Папка проекта \`${project.folderPath}\` сейчас пуста.`
      : `В папке проекта \`${project.folderPath}\` обнаружено файлов: **${projectFiles.length}** (${projectFiles
          .slice(0, 8)
          .map((f) => `\`${f.path}\``)
          .join(', ')}${projectFiles.length > 8 ? '…' : ''}).`;

  return {
    replyText:
      `${filesSummary}\n\n` +
      `Ни локальный \`llama-server\` / \`Ollama\`, ни облачный API-ключ бесплатного провайдера сейчас не подключены к инференсу, поэтому генерация свободного текста модели недоступна.\n\n` +
      `Доступны реальные прямые операции над проектом:\n` +
      `- \`/run <команда>\` — реальный запуск команды в \`${project.folderPath}\` (например, \`/run python3 hello.py\` или \`/run ls -la\`)\n` +
      `- \`/git status\` | \`/git diff\` | \`/git log\` — реальный Git в папке проекта\n` +
      `- \`/search <текст>\` — поиск по коду проекта\n` +
      `- \`/undo\` — откат последнего изменения файла на диске`,
    readFiles: readFilesList,
    usedLiveLlm: false,
  };
}
