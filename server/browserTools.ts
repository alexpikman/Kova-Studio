import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_HTML_BYTES = 1024 * 1024;
const MAX_PAGE_TEXT = 12000;
const SEARCH_URL = 'https://html.duckduckgo.com/html/';

export interface PublicSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface PublicPageResult {
  title: string;
  url: string;
  text: string;
}

function isPrivateAddress(address: string): boolean {
  const mappedIpv4 = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateAddress(mappedIpv4[1]);

  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && c === 0))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  const normalized = address.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
  );
}

export async function validatePublicHttpsUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Укажите корректный HTTPS-адрес публичной страницы.');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('Разрешено читать только публичные HTTPS-страницы.');
  }

  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Адрес ведёт в локальную или приватную сеть и заблокирован.');
  }

  return url;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|iframe|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<(br|hr|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function extractTitle(html: string): string {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return match ? htmlToText(match[1]).slice(0, 200) : '';
}

async function readLimitedBody(response: Response): Promise<string> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_HTML_BYTES) {
    throw new Error('Страница слишком большая для чтения.');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error('Страница слишком большая для чтения.');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchPublicHtml(input: string): Promise<{ url: string; html: string }> {
  let url = await validatePublicHttpsUrl(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
          'User-Agent': 'Kova-Studio/1.0 (public read-only web viewer)',
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 3) throw new Error('Слишком много перенаправлений.');
        url = await validatePublicHttpsUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw new Error(`Веб-страница ответила HTTP ${response.status}.`);
      const contentType = response.headers.get('content-type') || '';
      if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
        throw new Error('Эта страница не содержит читаемый HTML или обычный текст.');
      }

      return { url: url.toString(), html: await readLimitedBody(response) };
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Истекло время ожидания веб-страницы.');
      throw new Error(error instanceof Error ? error.message : 'Не удалось открыть веб-страницу.');
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('Не удалось открыть веб-страницу.');
}

function parseSearchResults(html: string): PublicSearchResult[] {
  const anchors = [...html.matchAll(/<a\b([^>]*class=["'][^"']*result__a[^"']*["'][^>]*)>([\s\S]*?)<\/a\s*>/gi)];
  const results: PublicSearchResult[] = [];

  for (let index = 0; index < anchors.length && results.length < 6; index++) {
    const match = anchors[index];
    const attributes = match[1];
    const hrefMatch = attributes.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    let url: URL;
    try {
      url = new URL(decodeHtmlEntities(hrefMatch[1]), SEARCH_URL);
      if (url.hostname.endsWith('duckduckgo.com') && url.pathname === '/l/') {
        const destination = url.searchParams.get('uddg');
        if (!destination) continue;
        url = new URL(destination);
      }
    } catch {
      continue;
    }
    if (url.protocol !== 'https:') continue;

    const nextAnchor = anchors[index + 1]?.index ?? html.length;
    const segment = html.slice(match.index, nextAnchor);
    const snippetMatch = segment.match(
      /<[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    );
    results.push({
      title: htmlToText(match[2]).slice(0, 240),
      url: url.toString(),
      snippet: snippetMatch ? htmlToText(snippetMatch[1]).slice(0, 600) : '',
    });
  }

  return results;
}

export async function searchPublicWeb(query: string): Promise<PublicSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 300) {
    throw new Error('Введите поисковый запрос длиной до 300 символов.');
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', trimmed);
  const { html } = await fetchPublicHtml(url.toString());
  return parseSearchResults(html);
}

export async function readPublicWebPage(input: string): Promise<PublicPageResult> {
  const { url, html } = await fetchPublicHtml(input);
  const text = htmlToText(html).slice(0, MAX_PAGE_TEXT);
  if (!text) throw new Error('На странице не найден читаемый текст.');
  return { title: extractTitle(html) || url, url, text };
}
