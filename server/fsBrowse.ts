import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface FsDirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes?: number;
}

export interface FsBrowseResult {
  currentPath: string;
  parentPath: string | null;
  exists: boolean;
  isDirectory: boolean;
  readable: boolean;
  writable: boolean;
  entries: FsDirectoryEntry[];
  roots: string[];
  error?: string;
}

export async function browseDirectory(inputPath?: string): Promise<FsBrowseResult> {
  const target = path.resolve(inputPath?.trim() || os.homedir());
  const parsed = path.parse(target);
  const parentPath = parsed.dir && parsed.dir !== target ? path.dirname(target) : null;

  const roots =
    os.platform() === 'win32'
      ? ['C:\\', 'D:\\', os.homedir()].filter((p) => fs.existsSync(p))
      : ['/', os.homedir(), process.cwd()].filter((v, idx, a) => a.indexOf(v) === idx && fs.existsSync(v));

  if (!fs.existsSync(target)) {
    return {
      currentPath: target,
      parentPath,
      exists: false,
      isDirectory: false,
      readable: false,
      writable: false,
      entries: [],
      roots,
      error: `Путь не существует: ${target}`,
    };
  }

  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    return {
      currentPath: target,
      parentPath,
      exists: true,
      isDirectory: false,
      readable: false,
      writable: false,
      entries: [],
      roots,
      error: `Указанный путь не является каталогом: ${target}`,
    };
  }

  let readable = false;
  let writable = false;
  try {
    fs.accessSync(target, fs.constants.R_OK);
    readable = true;
  } catch {
    readable = false;
  }
  try {
    fs.accessSync(target, fs.constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }

  const entries: FsDirectoryEntry[] = [];
  try {
    const dirItems = fs.readdirSync(target, { withFileTypes: true });
    for (const item of dirItems) {
      if (item.name.startsWith('.') && item.name !== '.kova-studio') continue;
      const fullPath = path.join(target, item.name);
      entries.push({
        name: item.name,
        path: fullPath,
        isDirectory: item.isDirectory(),
      });
    }
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    return {
      currentPath: target,
      parentPath,
      exists: true,
      isDirectory: true,
      readable,
      writable,
      entries: [],
      roots,
      error: err instanceof Error ? err.message : 'Ошибка чтения каталога',
    };
  }

  return {
    currentPath: target,
    parentPath,
    exists: true,
    isDirectory: true,
    readable,
    writable,
    entries: entries.slice(0, 250),
    roots,
  };
}

export async function createDirectory(parentDir: string, name: string): Promise<{ path: string }> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.includes('/') || cleanName.includes('\\') || cleanName === '..') {
    throw new Error('Некорректное имя папки');
  }
  const full = path.join(path.resolve(parentDir), cleanName);
  fs.mkdirSync(full, { recursive: true });
  return { path: full };
}

export async function tryNativeFolderPicker(): Promise<{
  supported: boolean;
  selectedPath?: string;
  cancelled?: boolean;
  reason?: string;
}> {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const { stdout } = await execFileAsync(
        'osascript',
        ['-e', 'POSIX path of (choose folder with prompt "Выберите папку проекта ONE CORE AI")'],
        { timeout: 60000 },
      );
      return { supported: true, selectedPath: stdout.trim() };
    }
    if (platform === 'win32') {
      const psScript = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }`;
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psScript], {
        timeout: 60000,
      });
      const p = stdout.trim();
      return p ? { supported: true, selectedPath: p } : { supported: true, cancelled: true };
    }
    if (platform === 'linux') {
      if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
        return {
          supported: false,
          reason: 'Сервер работает в headless-окружении без GUI (DISPLAY/WAYLAND_DISPLAY отсутствуют). Используйте встроенный файловый браузер.',
        };
      }
      const { stdout } = await execFileAsync(
        'zenity',
        ['--file-selection', '--directory', '--title=Выберите папку проекта ONE CORE AI'],
        { timeout: 60000 },
      );
      const p = stdout.trim();
      return p ? { supported: true, selectedPath: p } : { supported: true, cancelled: true };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('cancel') || msg.includes('User canceled')) {
      return { supported: true, cancelled: true };
    }
    return {
      supported: false,
      reason: `Системный диалог выбора папки недоступен: ${msg}`,
    };
  }
  return { supported: false, reason: 'Неподдерживаемая ОС для нативного диалога' };
}
