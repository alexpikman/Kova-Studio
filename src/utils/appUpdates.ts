import type { AppUpdateRelease } from '../types/kova';

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.2.0';

function parseVersion(value: string): { parts: number[]; prerelease: boolean } | null {
  const normalized = value.trim().replace(/^v/i, '');
  const match = normalized.match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    parts: match[1].split('.').map(Number),
    prerelease: Boolean(match[2]),
  };
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const installed = parseVersion(current);
  if (!next || !installed) return false;

  const length = Math.max(next.parts.length, installed.parts.length);
  for (let index = 0; index < length; index++) {
    const difference = (next.parts[index] ?? 0) - (installed.parts[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return installed.prerelease && !next.prerelease;
}

export async function fetchLatestRelease(repository: string): Promise<AppUpdateRelease> {
  const normalized = repository
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '');
  const match = normalized.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) throw new Error('В настройках указан некорректный репозиторий GitHub.');

  const [, owner, repo] = match;
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`,
    {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    },
  );
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? `В ${owner}/${repo} пока нет опубликованных релизов.`
        : `GitHub вернул HTTP ${response.status} при проверке обновлений.`,
    );
  }

  const release = (await response.json()) as {
    tag_name?: unknown;
    html_url?: unknown;
    body?: unknown;
    published_at?: unknown;
    assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
  };
  const version = typeof release.tag_name === 'string' ? release.tag_name.replace(/^v/i, '') : '';
  const releaseUrl = typeof release.html_url === 'string' ? release.html_url : '';
  if (!version || !releaseUrl) {
    throw new Error('GitHub вернул неполные данные о последнем релизе.');
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const installer =
    assets.find(
      (asset) =>
        typeof asset.name === 'string' &&
        /setup.*\.exe$/i.test(asset.name) &&
        typeof asset.browser_download_url === 'string',
    ) ??
    assets.find(
      (asset) =>
        typeof asset.name === 'string' &&
        /\.exe$/i.test(asset.name) &&
        typeof asset.browser_download_url === 'string',
    );

  return {
    version,
    releaseUrl,
    downloadUrl:
      installer && typeof installer.browser_download_url === 'string'
        ? installer.browser_download_url
        : releaseUrl,
    notes: typeof release.body === 'string' ? release.body : '',
    publishedAt: typeof release.published_at === 'string' ? release.published_at : '',
    isNewer: isNewerVersion(version, APP_VERSION),
  };
}
