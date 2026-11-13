import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface HFModelRaw {
  id: string;
  modelId?: string;
  author?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  lastModified?: string;
  library_name?: string;
  pipeline_tag?: string;
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'kova-studio-proxy', timestamp: Date.now() });
  });

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
      if (q) {
        url.searchParams.set('search', q);
      } else {
        url.searchParams.set('search', 'coder gguf');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KovaStudio/1.0',
        },
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
      const message = err instanceof Error ? err.message : 'Network error';
      res.status(502).json({
        source: 'huggingface-error',
        error: message,
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
      const encodedRepo = repoId
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

      const response = await fetch(`https://huggingface.co/api/models/${encodedRepo}?blobs=true`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KovaStudio/1.0',
        },
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
      const message = err instanceof Error ? err.message : 'Network error';
      res.status(502).json({ error: message, files: [] });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kova Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
