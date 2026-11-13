import fs from 'fs';
import os from 'os';
import path from 'path';

export function getKovaHome(): string {
  const base = process.env.KOVA_HOME?.trim() || path.join(os.homedir(), '.kova-studio');
  return path.resolve(base);
}

export function ensureKovaDirs(): {
  home: string;
  modelsDir: string;
  reposDir: string;
  workspacesDir: string;
  logsDir: string;
} {
  const home = getKovaHome();
  const modelsDir = path.join(home, 'models');
  const reposDir = path.join(home, 'repos');
  const workspacesDir = path.join(home, 'workspaces');
  const logsDir = path.join(home, 'logs');

  for (const dir of [home, modelsDir, reposDir, workspacesDir, logsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return { home, modelsDir, reposDir, workspacesDir, logsDir };
}

export function getModelsManifestPath(): string {
  return path.join(ensureKovaDirs().home, 'models.json');
}

export function getProjectsManifestPath(): string {
  return path.join(ensureKovaDirs().home, 'projects.json');
}

export function getVaultPath(): string {
  return path.join(ensureKovaDirs().home, 'vault.enc.json');
}
