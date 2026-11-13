import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileCode2,
  HardDrive,
  Link2,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { CURATED_GGUF_MODELS } from '../../data/curatedModels';
import { useKovaStore } from '../../store/useKovaStore';
import type { GgufFileVariant, ModelCatalogItem } from '../../types/kova';
import { cn } from '../../utils/cn';

type SourceFilter = 'all' | 'huggingface' | 'curated';
type QuantFilter = 'ALL' | 'Q4_K_M' | 'Q5_K_M' | 'Q8_0';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const ModelHubView: React.FC = () => {
  const {
    localModels,
    activeModelId,
    selectLocalModel,
    deleteLocalModel,
    startDownload,
    startDownloadFromCatalog,
    togglePauseDownload,
    inferenceSettings,
    appSettings,
    setActiveTab,
  } = useKovaStore();

  const [query, setQuery] = useState('Qwen 2.5 Coder GGUF');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [quantFilter, setQuantFilter] = useState<QuantFilter>('ALL');
  const [onlyFitsVram, setOnlyFitsVram] = useState(false);

  const [hfModels, setHfModels] = useState<ModelCatalogItem[]>([]);
  const [hfLoading, setHfLoading] = useState(false);
  const [hfError, setHfError] = useState<string | null>(null);

  const [expandedRepoId, setExpandedRepoId] = useState<string | null>(null);
  const [repoFilesMap, setRepoFilesMap] = useState<Record<string, GgufFileVariant[]>>({});
  const [loadingFilesFor, setLoadingFilesFor] = useState<string | null>(null);

  const [directUrl, setDirectUrl] = useState('');
  const [safetensorsOpen, setSafetensorsOpen] = useState(false);

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
          ? `Hugging Face API недоступен (${err.message}). Показан курируемый каталог.`
          : 'Ошибка запроса к Hugging Face API',
      );
    } finally {
      setHfLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHuggingFace('Qwen2.5-Coder GGUF');
  }, [fetchHuggingFace]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceFilter !== 'curated') {
      fetchHuggingFace(query);
    }
  };

  const inspectRepoFiles = async (item: ModelCatalogItem) => {
    if (expandedRepoId === item.repoId) {
      setExpandedRepoId(null);
      return;
    }
    setExpandedRepoId(item.repoId);

    if (repoFilesMap[item.repoId]) return;
    if (item.files && item.files.length > 0 && item.source === 'curated') {
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
      // keep curated files if offline
    } finally {
      setLoadingFilesFor(null);
    }
  };

  const handleDirectUrlDownload = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = directUrl.trim();
    if (!trimmed) return;
    const rawName = trimmed.split('/').pop()?.split('?')[0] || 'custom-model-q4_k_m.gguf';
    const filename = rawName.endsWith('.gguf') ? rawName : `${rawName}.gguf`;
    startDownload({
      repoId: `direct/${filename}`,
      name: filename.replace(/\.gguf$/i, ''),
      quant: 'Q4_K_M',
      filename,
      sizeGb: 4.8,
      minVramGb: 5.9,
      minRamGb: 8.0,
      license: 'direct-url',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
    setDirectUrl('');
  };

  const combinedCatalog = useMemo(() => {
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
      if (onlyFitsVram && m.minVramGb > inferenceSettings.maxVramGb) {
        return false;
      }
      return true;
    });
  }, [hfModels, query, sourceFilter, quantFilter, onlyFitsVram, inferenceSettings.maxVramGb]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header & Direct URL + Safetensors Action */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Автономный менеджер GGUF-моделей
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              Прямой поиск совместимых с <span className="font-mono">llama.cpp</span> моделей на Hugging Face Hub, загрузка с докачкой и проверкой SHA256 в{' '}
              <span className="font-mono">{appSettings.modelsDir}</span> без Ollama и Python.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSafetensorsOpen(true)}
              className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Конвертировать локальный safetensors</span>
            </button>
          </div>
        </div>

        {/* Local Storage & Active Downloads */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-zinc-500" />
              <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Локальные модели и очередь загрузок ({localModels.length})
              </h2>
            </div>
            <span className="font-mono text-xs text-zinc-500 tabular-nums">
              Профиль железа: {inferenceSettings.maxVramGb} GB VRAM · {inferenceSettings.maxRamGb} GB RAM
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {localModels.map((m) => {
              const isActive = m.id === activeModelId;
              return (
                <div
                  key={m.id}
                  className={cn(
                    'p-3 rounded-lg border flex flex-col justify-between gap-2.5',
                    isActive
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
                        <span>{m.sizeGb} GB</span>
                        <span>·</span>
                        <span>{m.license}</span>
                        <span>·</span>
                        <span>
                          {m.status === 'ready'
                            ? 'SHA256 OK'
                            : m.status === 'verifying'
                              ? 'Проверка SHA256...'
                              : m.status === 'paused'
                                ? `Пауза (${m.progressPct}%)`
                                : `${m.progressPct}% (${m.speedMbps} MB/s)`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(m.status === 'downloading' || m.status === 'paused') && (
                        <button
                          type="button"
                          onClick={() => togglePauseDownload(m.id)}
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
                          onClick={() => {
                            selectLocalModel(m.id);
                            setActiveTab('workstation');
                          }}
                          className={cn(
                            'h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                            isActive
                              ? 'bg-emerald-600 text-white'
                              : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white',
                          )}
                        >
                          {isActive ? 'Активна в агенте' : 'Загрузить в VRAM'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteLocalModel(m.id)}
                        title="Удалить модель"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {m.status !== 'ready' && (
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all duration-200',
                            m.status === 'verifying'
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Search, Source Filter & Direct URL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form onSubmit={handleSearchSubmit} className="lg:col-span-2 flex gap-2">
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

          <form onSubmit={handleDirectUrlDownload} className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="Прямая ссылка на .gguf..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={!directUrl.trim()}
              className="h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] hover:border-blue-500 disabled:opacity-45 text-xs font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap shrink-0 transition-colors"
            >
              По URL
            </button>
          </form>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-200/75 dark:bg-zinc-800/80">
              {(
                [
                  { id: 'all', label: 'Все источники' },
                  { id: 'huggingface', label: 'Hugging Face Live' },
                  { id: 'curated', label: 'Курируемый каталог' },
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
              checked={onlyFitsVram}
              onChange={(e) => setOnlyFitsVram(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>Только помещающиеся в {inferenceSettings.maxVramGb} GB VRAM</span>
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
              Попробуйте сбросить фильтр квантизации или снять ограничение VRAM.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {combinedCatalog.map((item) => {
              const fitsVram = item.minVramGb <= inferenceSettings.maxVramGb;
              const isExpanded = expandedRepoId === item.repoId;
              const files = repoFilesMap[item.repoId] ?? item.files ?? [];
              const alreadyQueued = localModels.some((m) => m.repoId === item.repoId);

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
                          <span>·</span>
                          <span>{formatCount(item.likes)} лайков</span>
                        </div>
                      </div>
                    </div>

                    {item.description && (
                      <p className="mt-2.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                        ~{item.sizeGb} GB ({item.defaultQuant}) · VRAM ≥ {item.minVramGb} GB · RAM ≥ {item.minRamGb} GB
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          fitsVram
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {fitsVram ? 'Помещается в VRAM' : 'Частичная выгрузка в RAM'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => inspectRepoFiles(item)}
                      className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <span>Файлы GGUF</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => startDownloadFromCatalog(item, quantFilter === 'ALL' ? item.defaultQuant : quantFilter)}
                      className={cn(
                        'h-9 px-3.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                        alreadyQueued
                          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          : 'bg-blue-600 hover:bg-blue-500 text-white',
                      )}
                    >
                      {alreadyQueued ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>В локальной библиотеке</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>
                            Скачать {quantFilter === 'ALL' ? item.defaultQuant : quantFilter}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expanded GGUF files from /api/hf/model */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                      {loadingFilesFor === item.repoId ? (
                        <div className="text-xs text-zinc-500 font-mono">
                          Загрузка списка .gguf и LFS SHA256 с Hugging Face...
                        </div>
                      ) : files.length === 0 ? (
                        <div className="text-xs text-zinc-500">
                          Точный список файлов недоступен; используйте кнопку быстрой загрузки выше.
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
                                onClick={() =>
                                  startDownload({
                                    repoId: item.repoId,
                                    name: item.name,
                                    quant: f.quant,
                                    filename: f.filename,
                                    sizeGb: f.sizeGb || item.sizeGb,
                                    minVramGb: Number(((f.sizeGb || item.sizeGb) + 1.1).toFixed(1)),
                                    minRamGb: Number(((f.sizeGb || item.sizeGb) + 3.0).toFixed(1)),
                                    license: item.license,
                                    sha256: f.sha256 ?? 'verified-lfs-sha256',
                                  })
                                }
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

      {/* Optional Safetensors Conversion Modal */}
      {safetensorsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Опциональная конвертация safetensors → GGUF
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Базовый рантайм Kova Studio не требует Python. Конвертация локальных весов Hugging Face вынесена в опциональный внешний инструмент.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSafetensorsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-xs leading-relaxed space-y-1.5">
              <div className="text-zinc-400"># Шаг 1: Конвертация в F16 GGUF (если установлен Python)</div>
              <div>python convert_hf_to_gguf.py C:\Models\Qwen2.5-7B --outfile qwen-f16.gguf</div>
              <div className="text-zinc-400 pt-1"># Шаг 2: Квантизация бинарником llama-quantize.exe (без Python)</div>
              <div>llama-quantize.exe qwen-f16.gguf qwen-q4_k_m.gguf Q4_K_M</div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Готовые GGUF из Hugging Face работают сразу из коробки
              </span>
              <button
                type="button"
                onClick={() => setSafetensorsOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
