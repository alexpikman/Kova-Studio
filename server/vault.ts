import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';
import { getVaultPath } from './paths';

const execFileAsync = promisify(execFile);
const SERVICE_NAME = 'kova-studio';

interface VaultStore {
  entries: Record<string, { iv: string; tag: string; data: string }>;
}

function deriveVaultKey(): Buffer {
  const seed = `${os.hostname()}|${os.userInfo().username}|${process.env.KOVA_HOME || os.homedir()}|kova-vault-v1`;
  return crypto.scryptSync(seed, 'kova-studio-local-vault-salt', 32);
}

function readEncryptedVault(): VaultStore {
  const vaultPath = getVaultPath();
  if (!fs.existsSync(vaultPath)) {
    return { entries: {} };
  }
  try {
    const raw = fs.readFileSync(vaultPath, 'utf-8');
    const parsed = JSON.parse(raw) as VaultStore;
    return parsed && typeof parsed.entries === 'object' ? parsed : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

function writeEncryptedVault(store: VaultStore): void {
  const vaultPath = getVaultPath();
  const tmpPath = `${vaultPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, vaultPath);
  try {
    fs.chmodSync(vaultPath, 0o600);
  } catch {
    // chmod may be a no-op on Windows
  }
}

async function tryOsKeychainSet(account: string, secret: string): Promise<boolean> {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      await execFileAsync('security', [
        'add-generic-password',
        '-a',
        account,
        '-s',
        SERVICE_NAME,
        '-w',
        secret,
        '-U',
      ]);
      return true;
    }
    if (platform === 'win32') {
      await execFileAsync('cmdkey', [
        `/generic:${SERVICE_NAME}:${account}`,
        `/user:${account}`,
        `/pass:${secret}`,
      ]);
      return true;
    }
    if (platform === 'linux' && process.env.DBUS_SESSION_BUS_ADDRESS) {
      await execFileAsync('which', ['secret-tool']);
      return false; // secret-tool expects stdin piping; fallback to AES-256-GCM vault unless interactive
    }
  } catch {
    return false;
  }
  return false;
}

async function tryOsKeychainGet(account: string): Promise<string | null> {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const { stdout } = await execFileAsync('security', [
        'find-generic-password',
        '-a',
        account,
        '-s',
        SERVICE_NAME,
        '-w',
      ]);
      return stdout.trimEnd();
    }
  } catch {
    return null;
  }
  return null;
}

async function tryOsKeychainDelete(account: string): Promise<void> {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      await execFileAsync('security', [
        'delete-generic-password',
        '-a',
        account,
        '-s',
        SERVICE_NAME,
      ]);
    } else if (platform === 'win32') {
      await execFileAsync('cmdkey', [`/delete:${SERVICE_NAME}:${account}`]);
    }
  } catch {
    // ignore missing keychain entries
  }
}

export async function setSecret(account: string, plaintext: string): Promise<{ backend: 'os-keychain' | 'aes-256-gcm-vault' }> {
  const osSaved = await tryOsKeychainSet(account, plaintext);
  if (osSaved) {
    return { backend: 'os-keychain' };
  }

  const key = deriveVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const store = readEncryptedVault();
  store.entries[account] = {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
  writeEncryptedVault(store);
  return { backend: 'aes-256-gcm-vault' };
}

export async function getSecret(account: string): Promise<string | null> {
  const fromOs = await tryOsKeychainGet(account);
  if (fromOs !== null) {
    return fromOs;
  }

  const store = readEncryptedVault();
  const entry = store.entries[account];
  if (!entry) return null;

  try {
    const key = deriveVaultKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(entry.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(entry.data, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf-8');
  } catch {
    return null;
  }
}

export async function deleteSecret(account: string): Promise<void> {
  await tryOsKeychainDelete(account);
  const store = readEncryptedVault();
  if (store.entries[account]) {
    delete store.entries[account];
    writeEncryptedVault(store);
  }
}
