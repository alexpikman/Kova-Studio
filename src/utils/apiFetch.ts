import { invoke } from '@tauri-apps/api/core';

let backendUrl: Promise<string> | undefined;

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api/') && isTauriRuntime()) {
    if (!backendUrl) {
      backendUrl = invoke<string>('get_backend_url').catch((error: unknown) => {
        backendUrl = undefined;
        throw new Error(`Не удалось подключиться к локальному API: ${String(error)}`);
      });
    }

    return fetch(new URL(input, await backendUrl), init);
  }

  return fetch(input, init);
}
