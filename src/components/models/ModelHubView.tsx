import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  ExternalLink,
  FolderInput,
  HardDrive,
  Link2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { CURATED_GGUF_MODELS } from '../../data/curatedModels';
import { useKovaStore } from '../../store/useKovaStore';
import type { GgufFileVariant, ModelCatalogItem, ModelRecommendation } from '../../types/kova';
import { cn } from '../../utils/cn';
import { apiFetch as fetch } from '../../utils/apiFetch';

type SourceFilter = 'all' | 'huggingface' | 'curated';
type QuantFilter = 'ALL' | 'Q4_K_M' | 'Q5_K_M' | 'Q8_0';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatEta(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}с`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}м ${secs}с`;
}

export const ModelHubView: React.FC = () => {
  const {
    hardwareProfile,
    hardwareLoading,
    hardwareError,
    refreshHardwareProfile,
    localModels,
    localModelsError,
    activeModelId,
    selectLocalModel,
    deleteLocalModel,
    startDownload,
    startDownloadFromCatalog,
    togglePauseDownload,
    importLocalModelFile,
    pullOllamaModel,
    appSettings,
    setActiveTab,
  } = useKovaStore();

  const [query, setQuery] = useState('Qwen 2.5 Coder GGUF');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [quantFilter, setQuantFilter] = useState<QuantFilter>('ALL');
  const [hideTooHeavy, setHideTooHeavy] = useState(false);

  const [hfModels, setHfModels] = useState<ModelCatalogItem[]>([]);
  const [hfLoading, setHfLoading] = useState(false);
  const [hfError, setHfError] = useState<string | null>(null);
  const [recommendationsMap, setRecommendationsMap] = useState<Record<string, ModelRecommendation>>({});

  const [expandedRepoId, setExpandedRepoId] = useState<string | null>(null);
  const [repoFilesMap, setRepoFilesMap] = useState<Record<string, GgufFileVariant[]>>({});
  const [loadingFilesFor, setLoadingFilesFor] = useState<string | null>(null);

  const [directUrl, setDirectUrl] = useState('');
  const [ollamaModelName, setOllamaModelName] = useState('');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://127.0.0.1:11434');
  const [importFilePath, setImportFilePath] = useState('');
  const [actionBanner, setActionBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchHuggingFace = useCallback(async (searchText: string) => {
    setHfLoading(true);
    setHfError(null);
    try {
      const res = await fetch(
        `/api/hf/models?q=${encodeURIComponent(searchText.trim() || 'coder gguf')}&mode=llama.cpp`,
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setHfModels(Array.isArray(data.models) ? data.models : []);
    } catch (err) {
      setHfError(
        err instanceof Error
          ? `Hugging Face API недоступен (${err.message}). Показан локальный каталог метаданных.`
          : 'Ошибка запроса к Hugging Face API',
      );
    } finally {
      setHfLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHuggingFace('Qwen2.5-Coder GGUF');
  }, [fetchHuggingFace]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceFilter !== 'curated') {
      void fetchHuggingFace(query);
    }
  };

  const baseCatalogList = useMemo(() => {
    const qLower = query.trim().toLowerCase();
    const curatedFiltered = CURATED_GGUF_MODELS.filter((m) => {
      if (!qLower) return true;
      const tokens = qLower.split(/\s+/).filter(Boolean);
      const hay = `${m.name} ${m.author} ${m.tags.join(' ')} ${m.description ?? ''}`.toLowerCase();
      return tokens.some((t) => hay.includes(t)) || qLower === 'qwen 2.5 coder gguf';
    });

    let list: ModelCatalogItem[] = [];
    if (sourceFilter === 'curated') {
      list = curatedFiltered;
    } else if (sourceFilter === 'huggingface') {
      list = hfModels;
    } else {
      const seen = new Set<string>();
      for (const item of [...hfModels, ...curatedFiltered]) {
        if (!seen.has(item.repoId)) {
          seen.add(item.repoId);
          list.push(item);
        }
      }
    }

    return list.filter((m) => {
      if (quantFilter !== 'ALL' && !m.quantizations.includes(quantFilter)) {
        return false;
      }
      return true;
    });
  }, [hfModels, query, sourceFilter, quantFilter]);

  // Ask backend hardware recommender for exact 3-tier classification
  useEffect(() => {
    if (!hardwareProfile || baseCatalogList.length === 0) return;
    let cancelled = false;

    const runRecommend = async () => {
      try {
        const res = await fetch('/api/hardware/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hardware: hardwareProfile,
            models: baseCatalogList.map((m) => ({
              id: m.repoId,
              name: m.name,
              quant: quantFilter === 'ALL' ? m.defaultQuant : quantFilter,
              sizeGb: m.sizeGb,
              minVramGb: m.minVramGb,
              minRamGb: m.minRamGb,
            })),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          recommendations?: ModelRecommendation[];
        };
        if (!cancelled && res.ok && data.ok && Array.isArray(data.recommendations)) {
          const nextMap: Record<string, ModelRecommendation> = {};
          for (const rec of data.recommendations) {
            nextMap[rec.id] = rec;
          }
          setRecommendationsMap(nextMap);
        }
      } catch {
        // ignore transient errors
      }
    };

    void runRecommend();
    return () => {
      cancelled = true;
    };
  }, [hardwareProfile, baseCatalogList, quantFilter]);

  const combinedCatalog = useMemo(() => {
    if (!hideTooHeavy) return baseCatalogList;
    return baseCatalogList.filter((m) => {
      const rec = recommendationsMap[m.repoId];
      return !rec || rec.category !== 'too-heavy';
    });
  }, [baseCatalogList, hideTooHeavy, recommendationsMap]);

  const inspectRepoFiles = async (item: ModelCatalogItem) => {
    if (expandedRepoId === item.repoId) {
      setExpandedRepoId(null);
      return;
    }
    setExpandedRepoId(item.repoId);

    if (repoFilesMap[item.repoId]) return;
    if (item.files && item.files.length > 0) {
      setRepoFilesMap((prev) => ({ ...prev, [item.repoId]: item.files! }));
    }

    setLoadingFilesFor(item.repoId);
    try {
      const res = await fetch(`/api/hf/model?repoId=${encodeURIComponent(item.repoId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.files) && data.files.length > 0) {
        setRepoFilesMap((prev) => ({ ...prev, [item.repoId]: data.files }));
      }
    } catch {
      // keep existing metadata if offline
    } finally {
      setLoadingFilesFor(null);
    }
  };

  const handleDirectUrlDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBanner(null);
    const trimmed = directUrl.trim();
    if (!trimmed) return;
    const rawName = trimmed.split('/').pop()?.split('?')[0] || 'model.gguf';
    const filename = rawName.endsWith('.gguf') ? rawName : `${rawName}.gguf`;
    const res = await startDownload({
      repoId: `direct/${filename}`,
      name: filename.replace(/\.gguf$/i, ''),
      quant: 'GGUF',
      filename,
      downloadUrl: trimmed,
      sizeGb: 0,
      minVramGb: 0,
      minRamGb: 0,
      license: 'direct-url',
      sha256: null,
    });
    if (res.ok) {
      setDirectUrl('');
      setActionBanner({ ok: true, msg: `Потоковая загрузка ${filename} запущена на диск.` });
    } else {
      setActionBanner({ ok: false, msg: res.error || 'Не удалось запустить загрузку по URL' });
    }
  };

  const handleOllamaPull = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBanner(null);
    if (!ollamaModelName.trim()) return;
    const res = await pullOllamaModel(ollamaModelName.trim(), ollamaBaseUrl.trim() || undefined);
    if (res.ok) {
      setActionBanner({
        ok: true,
        msg: `Запущен pull модели ${ollamaModelName.trim()} через Ollama (${ollamaBaseUrl}).`,
      });
      setOllamaModelName('');
    } else {
      setActionBanner({ ok: false, msg: res.error || 'Ошибка подключения к Ollama' });
    }
  };

  const handleLocalImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBanner(null);
    if (!importFilePath.trim()) return;
    const res = await importLocalModelFile(importFilePath.trim());
    if (res.ok) {
      setActionBanner({ ok: true, msg: `Файл ${importFilePath.trim()} проверен и добавлен в библиотеку.` });
      setImportFilePath('');
    } else {
      setActionBanner({ ok: false, msg: res.error || 'Ошибка импорта файла модели' });
    }
  };

  const handleDownloadCatalogItem = async (item: ModelCatalogItem, rec?: ModelRecommendation) => {
    setActionBanner(null);
    const res = await startDownloadFromCatalog(
      item,
      quantFilter === 'ALL' ? item.defaultQuant : quantFilter,
    );
    if (!res.ok) {
      setActionBanner({ ok: false, msg: res.error || 'Не удалось запустить скачивание' });
    } else if (rec?.category === 'too-heavy') {
      setActionBanner({
        ok: true,
        msg: `Загрузка ${item.name} запущена вручную с предупреждением: модель превышает текущую память (${rec.reason}).`,
      });
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Менеджер моделей и автодетект системы
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              Реальное скачивание на диск в <span className="font-mono">{appSettings.modelsDir}</span> с HTTP Range докачкой, проверкой SHA256, Ollama pull и импортом локальных <span className="font-mono">.gguf</span> / <span className="font-mono">.safetensors</span>.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 max-w-2xl">
              Поиск и скачивание публичных моделей Hugging Face работают без API-ключа. Ключ нужен только для закрытых моделей или облачных AI-провайдеров.
            </p>
          </div>
          <button
            type="button"
            disabled={hardwareLoading}
            onClick={() => void refreshHardwareProfile()}
            className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', hardwareLoading && 'animate-spin')} />
            <span>Обновить железо</span>
          </button>
        </div>

        {/* Section 1: Real Hardware Detection Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-500" />
              <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Реальный профиль системы
              </h2>
            </div>
            {hardwareProfile && (
              <span className="font-mono text-xs text-zinc-500">
                Бэкенд: <strong className="text-zinc-800 dark:text-zinc-200">{hardwareProfile.recommendedBackend.toUpperCase()}</strong> ({hardwareProfile.backendVersion})
              </span>
            )}
          </div>

          {hardwareError && (
            <div className="p-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300">
              {hardwareError}
            </div>
          )}

          {hardwareProfile ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
                  <div className="text-zinc-500 text-[11px]">ОС и CPU</div>
                  <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 mt-1 truncate">
                    {hardwareProfile.os.platform} · {hardwareProfile.os.arch} ({hardwareProfile.cpu.cores} ядер)
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate mt-0.5" title={hardwareProfile.cpu.model}>
                    {hardwareProfile.cpu.model}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
                  <div className="text-zinc-500 text-[11px]">Оперативная память (RAM)</div>
                  <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
                    Свободно {hardwareProfile.ram.freeGb} / {hardwareProfile.ram.totalGb} GB
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Хост: {hardwareProfile.os.hostname}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
                  <div className="text-zinc-500 text-[11px]">GPU и VRAM</div>
                  {hardwareProfile.gpuDetected && hardwareProfile.gpus.length > 0 ? (
                    <>
                      <div className="font-mono font-medium text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                        {hardwareProfile.gpus[0].name}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono tabular-nums mt-0.5">
                        VRAM: {hardwareProfile.freeVramGb} / {hardwareProfile.totalVramGb} GB · {hardwareProfile.gpus[0].driverOrRuntime}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-mono font-medium text-amber-600 dark:text-amber-400 mt-1">
                        Дискретный GPU не найден
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Доступен только CPU-инференс в RAM
                      </div>
                    </>
                  )}
                </div>

                <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
                  <div className="text-zinc-500 text-[11px]">Свободно на диске для моделей</div>
                  <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
                    {hardwareProfile.disk.freeGb} / {hardwareProfile.disk.totalGb} GB
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate mt-0.5" title={hardwareProfile.disk.path}>
                    {hardwareProfile.disk.path}
                  </div>
                </div>
              </div>

              {hardwareProfile.notes.length > 0 && (
                <div className="text-[11.5px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
                  {hardwareProfile.notes.map((n, idx) => (
                    <div key={idx}>• {n}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-zinc-500">Определение параметров железа...</div>
          )}
        </div>

        {actionBanner && (
          <div
            className={cn(
              'p-3 rounded-xl border text-xs flex items-center justify-between gap-3',
              actionBanner.ok
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
            )}
          >
            <span>{actionBanner.msg}</span>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="text-[11px] underline shrink-0"
            >
              Скрыть
            </button>
          </div>
        )}

        {/* Section 2: Real Local Models & Active Downloads */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-zinc-500" />
              <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Локальные модели на диске ({localModels.length})
              </h2>
            </div>
            <span className="font-mono text-xs text-zinc-500">
              Манифест моделей: models.json
            </span>
          </div>

          {localModelsError && (
            <div className="mb-3 p-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300">
              Не удалось загрузить список моделей: {localModelsError}
            </div>
          )}

          {localModels.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
              На диске пока нет локальных моделей. Скачайте модель из каталога ниже, по прямой ссылке, через Ollama или импортируйте локальный файл .gguf / .safetensors.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {localModels.map((m) => {
                const isActive = m.id === activeModelId;
                const isCorruptOrErr = m.status === 'corrupt' || m.status === 'error';
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'p-3 rounded-lg border flex flex-col justify-between gap-2.5',
                      isCorruptOrErr
                        ? 'border-rose-500/50 bg-rose-500/5'
                        : isActive
                          ? 'border-blue-500/60 bg-blue-500/5'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {m.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                          <span>{m.quant}</span>
                          <span>·</span>
                          <span>
                            {m.totalBytes > 0
                              ? `${formatBytes(m.downloadedBytes)} / ${formatBytes(m.totalBytes)}`
                              : `${m.sizeGb} GB`}
                          </span>
                          <span>·</span>
                          <span>
                            {m.status === 'ready'
                              ? m.sha256Verified
                                ? 'SHA256 OK'
                                : 'Готова'
                              : m.status === 'verifying'
                                ? 'Проверка SHA256...'
                                : m.status === 'corrupt'
                                  ? 'Файл повреждён (SHA256 mismatch)'
                                  : m.status === 'error'
                                    ? 'Ошибка загрузки'
                                    : m.status === 'paused'
                                      ? `Пауза (${m.progressPct}%)`
                                      : `${m.progressPct}% · ${m.speedMbps} MB/s · ETA ${formatEta(m.etaSeconds)}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(m.status === 'downloading' || m.status === 'paused' || m.status === 'error') &&
                          m.downloadUrl && (
                            <button
                              type="button"
                              onClick={() => void togglePauseDownload(m.id)}
                              className="h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              {m.status === 'downloading' ? (
                                <>
                                  <Pause className="w-3.5 h-3.5" />
                                  <span>Пауза</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5" />
                                  <span>Докачать</span>
                                </>
                              )}
                            </button>
                          )}
                        {m.status === 'ready' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await selectLocalModel(m.id);
                              if (!res.ok) {
                                setActionBanner({ ok: false, msg: res.error || 'Не удалось активировать модель' });
                              } else {
                                setActiveTab('workstation');
                              }
                            }}
                            className={cn(
                              'h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                              isActive
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white',
                            )}
                          >
                            {isActive ? 'Активна в агенте' : 'Активировать'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void deleteLocalModel(m.id)}
                          title="Удалить файл с диска и из манифеста"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {m.errorMessage && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>{m.errorMessage}</span>
                      </div>
                    )}

                    {m.status !== 'ready' && (
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all duration-200',
                              isCorruptOrErr
                                ? 'bg-rose-500'
                                : m.status === 'verifying'
                                  ? 'bg-emerald-500'
                                  : m.status === 'paused'
                                    ? 'bg-amber-500'
                                    : 'bg-blue-600',
                            )}
                            style={{ width: `${m.progressPct}%` }}
                          />
                        </div>
                        <div className="font-mono text-[10.5px] text-zinc-500 truncate">
                          {m.localPath}
                        </div>
                      </div>
                    )}

                    {m.status === 'ready' && m.computedSha256 && (
                      <div className="font-mono text-[10.5px] text-zinc-500 truncate flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>SHA256: {m.computedSha256.slice(0, 20)}… · {m.localPath}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Direct URL, Ollama Pull, Local File Import */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form onSubmit={handleDirectUrlDownload} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] space-y-2">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Прямая ссылка (HTTP Range)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="https://.../model.gguf"
                className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={!directUrl.trim()}
                className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white text-xs font-medium whitespace-nowrap"
              >
                Скачать
              </button>
            </div>
          </form>

          <form onSubmit={handleOllamaPull} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] space-y-2">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between gap-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-emerald-500" />
                <span>Ollama Pull</span>
              </span>
              <input
                type="text"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                className="w-36 h-6 px-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-[10.5px] text-zinc-500"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ollamaModelName}
                onChange={(e) => setOllamaModelName(e.target.value)}
                placeholder="qwen2.5-coder:7b"
                className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={!ollamaModelName.trim()}
                className="h-9 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-45 text-xs font-medium whitespace-nowrap"
              >
                Pull
              </button>
            </div>
          </form>

          <form onSubmit={handleLocalImport} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] space-y-2">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <FolderInput className="w-3.5 h-3.5 text-amber-500" />
              <span>Импорт локального файла</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={importFilePath}
                onChange={(e) => setImportFilePath(e.target.value)}
                placeholder="/path/to/model.gguf или .safetensors"
                className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={!importFilePath.trim()}
                className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 disabled:opacity-45 text-xs font-medium whitespace-nowrap"
              >
                Импорт
              </button>
            </div>
          </form>
        </div>

        {/* Search Hugging Face */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск GGUF на Hugging Face (например: Qwen 2.5 Coder 7B GGUF)..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={hfLoading}
            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', hfLoading && 'animate-spin')} />
            <span>Найти GGUF</span>
          </button>
        </form>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-200/75 dark:bg-zinc-800/80">
              {(
                [
                  { id: 'all', label: 'Все источники' },
                  { id: 'huggingface', label: 'Hugging Face Live' },
                  { id: 'curated', label: 'Каталог моделей' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSourceFilter(tab.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                    sourceFilter === tab.id
                      ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-200/75 dark:bg-zinc-800/80">
              {(['ALL', 'Q4_K_M', 'Q5_K_M', 'Q8_0'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantFilter(q)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap',
                    quantFilter === q
                      ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                  )}
                >
                  {q === 'ALL' ? 'Все квант.' : q}
                </button>
              ))}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={hideTooHeavy}
              onChange={(e) => setHideTooHeavy(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>Скрыть «Слишком тяжело» для моей системы</span>
          </label>
        </div>

        {hfError && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300">
            {hfError}
          </div>
        )}

        {/* Results Grid */}
        {hfLoading && combinedCatalog.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((skeleton) => (
              <div
                key={skeleton}
                className="h-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 animate-pulse"
              />
            ))}
          </div>
        ) : combinedCatalog.length === 0 ? (
          <div className="p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] text-center">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              По текущим фильтрам модели не найдены
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Попробуйте сбросить фильтр квантизации или показать все модели.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {combinedCatalog.map((item) => {
              const rec = recommendationsMap[item.repoId];
              const isExpanded = expandedRepoId === item.repoId;
              const files = repoFilesMap[item.repoId] ?? item.files ?? [];
              const alreadyQueued = localModels.some((m) => m.repoId === item.repoId);

              const badgeStyle =
                rec?.category === 'fits-vram'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : rec?.category === 'fits-ram'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';

              return (
                <div
                  key={item.repoId}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1.5 max-w-full"
                        >
                          <span className="truncate">{item.name}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        </a>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                          <span>{item.author}</span>
                          <span>·</span>
                          <span>{item.source === 'huggingface' ? 'Hugging Face' : 'Каталог'}</span>
                          <span>·</span>
                          <span className="font-mono">{item.license}</span>
                          <span>·</span>
                          <span>{formatCount(item.downloads)} скачиваний</span>
                        </div>
                      </div>

                      {rec && (
                        <span className={cn('px-2 py-0.5 rounded-md border text-[11px] font-medium shrink-0', badgeStyle)}>
                          {rec.categoryLabel}
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <p className="mt-2.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1 text-xs">
                      <div className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                        ~{item.sizeGb} GB ({item.defaultQuant}) · VRAM ≥ {rec?.requiredVramGb ?? item.minVramGb} GB · RAM ≥ {rec?.requiredRamGb ?? item.minRamGb} GB
                      </div>
                      {rec && (
                        <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                          {rec.reason}
                        </div>
                      )}
                      {rec?.warning && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{rec.warning}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void inspectRepoFiles(item)}
                      className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <span>Файлы GGUF</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDownloadCatalogItem(item, rec)}
                      className={cn(
                        'h-9 px-3.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                        alreadyQueued
                          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          : rec?.category === 'too-heavy'
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white',
                      )}
                    >
                      {alreadyQueued ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>В библиотеке</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>
                            {rec?.category === 'too-heavy'
                              ? `Скачать вручную (${quantFilter === 'ALL' ? item.defaultQuant : quantFilter})`
                              : `Скачать ${quantFilter === 'ALL' ? item.defaultQuant : quantFilter}`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expanded GGUF files */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                      {loadingFilesFor === item.repoId ? (
                        <div className="text-xs text-zinc-500 font-mono">
                          Загрузка списка .gguf и LFS SHA256 с Hugging Face...
                        </div>
                      ) : files.length === 0 ? (
                        <div className="text-xs text-zinc-500">
                          Не удалось получить список файлов репозитория с Hugging Face.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                          {files.slice(0, 8).map((f) => (
                            <div
                              key={f.filename}
                              className="p-2 rounded-lg border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-mono text-[11.5px] text-zinc-900 dark:text-zinc-100 truncate">
                                  {f.filename}
                                </div>
                                <div className="font-mono text-[10.5px] text-zinc-500 tabular-nums mt-0.5">
                                  {f.quant} · {f.sizeGb} GB
                                  {f.sha256 ? ` · SHA256 ${f.sha256.slice(0, 12)}…` : ''}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await startDownload({
                                    repoId: item.repoId,
                                    name: item.name,
                                    quant: f.quant,
                                    filename: f.filename,
                                    downloadUrl: f.downloadUrl,
                                    sizeGb: f.sizeGb || item.sizeGb,
                                    totalBytes: f.sizeBytes,
                                    minVramGb: Number(((f.sizeGb || item.sizeGb) * 1.15 + 0.7).toFixed(1)),
                                    minRamGb: Number(((f.sizeGb || item.sizeGb) * 1.2 + 1.2).toFixed(1)),
                                    license: item.license,
                                    sha256: f.sha256 ?? null,
                                  });
                                  if (!res.ok) {
                                    setActionBanner({ ok: false, msg: res.error || 'Ошибка загрузки файла' });
                                  }
                                }}
                                className="px-2.5 py-1 rounded text-[11px] font-medium bg-blue-600 hover:bg-blue-500 text-white shrink-0 whitespace-nowrap"
                              >
                                Скачать
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
