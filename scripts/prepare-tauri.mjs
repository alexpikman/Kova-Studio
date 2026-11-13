import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  throw new Error('The Windows Tauri installer must be built on Windows to bundle node.exe.');
}

const nodeRuntime = process.execPath;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendBundle = resolve(projectRoot, 'dist', 'backend.cjs');
if (!statSync(backendBundle, { throwIfNoEntry: false })?.isFile()) {
  throw new Error(`Bundled backend not found: ${backendBundle}. Run npm run build first.`);
}

const runtimeDir = resolve(projectRoot, 'src-tauri', 'runtime');
mkdirSync(runtimeDir, { recursive: true });
const bundledNode = resolve(runtimeDir, 'node.exe');
copyFileSync(nodeRuntime, bundledNode);
console.log(`Bundled Node.js runtime from ${nodeRuntime}`);
