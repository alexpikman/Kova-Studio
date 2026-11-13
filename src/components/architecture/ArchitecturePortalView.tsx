import React, { useState } from 'react';
import { Check, Code2, Copy, Cpu, FolderTree, Layers, Map, TerminalSquare } from 'lucide-react';
import {
  ARCHITECTURE_MODULES,
  CODE_SNIPPETS,
  PROJECT_FOLDER_STRUCTURE,
  ROADMAP_STAGES,
  TAURI_IPC_SPECS,
} from '../../data/architectureBlueprint';
import { cn } from '../../utils/cn';

type PortalTab = 'diagram' | 'ipc' | 'structure' | 'roadmap' | 'code';

const PORTAL_TABS: { id: PortalTab; label: string; icon: React.ReactNode }[] = [
  { id: 'diagram', label: 'Архитектура модулей', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'ipc', label: 'Tauri Commands API', icon: <TerminalSquare className="w-3.5 h-3.5" /> },
  { id: 'structure', label: 'Структура проекта', icon: <FolderTree className="w-3.5 h-3.5" /> },
  { id: 'roadmap', label: 'План реализации', icon: <Map className="w-3.5 h-3.5" /> },
  { id: 'code', label: 'Примеры кода (Rust / React)', icon: <Code2 className="w-3.5 h-3.5" /> },
];

export const ArchitecturePortalView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<PortalTab>('diagram');
  const [selectedModuleId, setSelectedModuleId] = useState(ARCHITECTURE_MODULES[0].id);
  const [ipcFilter, setIpcFilter] = useState<'all' | 'invoke' | 'event'>('all');
  const [activeSnippetId, setActiveSnippetId] = useState(CODE_SNIPPETS[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedModule =
    ARCHITECTURE_MODULES.find((m) => m.id === selectedModuleId) ?? ARCHITECTURE_MODULES[0];
  const activeSnippet =
    CODE_SNIPPETS.find((s) => s.id === activeSnippetId) ?? CODE_SNIPPETS[0];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const filteredIpc = TAURI_IPC_SPECS.filter((item) =>
    ipcFilter === 'all' ? true : item.direction === ipcFilter,
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Title & Key Specs */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Архитектура и спецификация Windows-клиента (Tauri 2.0 + llama.cpp)
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-3xl">
              Целевой бандл &lt; 30 МБ на базе Edge WebView2 и Rust без Electron, Ollama и Python. Автономная загрузка GGUF, авто-детект CUDA/Vulkan, SQLite-чекпоинты и Zustand-синхронизация.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
            <span>RAM в простое ~25–45 МБ</span>
            <span>·</span>
            <span>Windows 10/11 x64</span>
          </div>
        </div>

        {/* Sub-Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-200/75 dark:bg-zinc-800/80 w-fit">
          {PORTAL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubTab(t.id)}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                activeSubTab === t.id
                  ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: Architecture Modules & Diagram */}
        {activeSubTab === 'diagram' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5">
                <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  Схема взаимодействия модулей (нажмите на блок для деталей)
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ARCHITECTURE_MODULES.map((mod) => {
                    const active = mod.id === selectedModuleId;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => setSelectedModuleId(mod.id)}
                        className={cn(
                          'text-left p-4 rounded-xl border transition-colors',
                          active
                            ? 'border-blue-500 bg-blue-500/5'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700',
                        )}
                      >
                        <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          {mod.layer}
                        </div>
                        <div className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                          {mod.title}
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {mod.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl bg-zinc-950 text-zinc-300 p-4 font-mono text-[11.5px] leading-5 overflow-x-auto border border-zinc-800">
                  <pre>{`┌──────────────────────────────────────────────────────────────────────┐
│  WebView2 Frontend (React 19 + TypeScript + Tailwind + Zustand)      │
│  3-Column IDE · Plan/Act · GitDiffViewer · Model Hub · Tray UI       │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Tauri IPC (invoke + emit events)
┌───────────────────────────────▼──────────────────────────────────────┐
│  Rust Core (src-tauri)                                               │
│  ├─ Agent Core: контекст, tool-calls, диффы, PowerShell, Checkpoints │
│  ├─ Model Manager: HF API, reqwest Range-докачка, SHA256, %APPDATA%  │
│  ├─ SQLite (rusqlite): сессии чатов, метаданные моделей, снапшоты    │
│  └─ llama.cpp Bridge: auto-detect CUDA/Vulkan/CPU + Win32 JobObject  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Sidecar (127.0.0.1:8080 OpenAI SSE)
┌───────────────────────────────▼──────────────────────────────────────┐
│  llama-server-x86_64-pc-windows-msvc.exe (GGUF Q4_K_M / Q5_K_M)      │
└──────────────────────────────────────────────────────────────────────┘`}</pre>
                </div>
              </div>
            </div>

            {/* Selected Module Inspector */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
                <div>
                  <div className="text-xs font-mono text-blue-600 dark:text-blue-400">
                    {selectedModule.layer}
                  </div>
                  <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {selectedModule.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    {selectedModule.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Ключевые обязанности
                  </div>
                  <ul className="space-y-1.5">
                    {selectedModule.responsibilities.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        <span className="text-zinc-400 mt-0.5">·</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                    Критические зависимости
                  </div>
                  <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {selectedModule.cratesOrPackages.join(' · ')}
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                    Точки соприкосновения IPC
                  </div>
                  <div className="space-y-1 font-mono text-xs text-blue-600 dark:text-blue-400">
                    {selectedModule.ipcTouchpoints.map((t) => (
                      <div key={t}>{t}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Tauri IPC Specification */}
        {activeSubTab === 'ipc' && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Спецификация API между Rust и React (Tauri 2.0 IPC)
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Типизированные команды invoke() и потоковые события app.emit() с контролем прав в capabilities/default.json
                </p>
              </div>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-200/75 dark:bg-zinc-800/80">
                {(['all', 'invoke', 'event'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setIpcFilter(f)}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                      ipcFilter === f
                        ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400',
                    )}
                  >
                    {f === 'all' ? 'Все' : f === 'invoke' ? 'Commands (invoke)' : 'Events (emit)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-50/70 dark:bg-zinc-900/40">
                    <th className="py-2.5 px-4">Команда / Событие</th>
                    <th className="py-2.5 px-4">Модуль</th>
                    <th className="py-2.5 px-4">Входные параметры (Payload)</th>
                    <th className="py-2.5 px-4">Возврат / Поток</th>
                    <th className="py-2.5 px-4">Назначение и права</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80 text-xs">
                  {filteredIpc.map((row) => (
                    <tr key={row.name} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30">
                      <td className="py-3 px-4 align-top font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {row.name}
                        <div className="text-[10.5px] text-zinc-500 font-normal mt-0.5">
                          {row.direction === 'invoke' ? 'React → Rust' : 'Rust → React'}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        {row.module}
                      </td>
                      <td className="py-3 px-4 align-top font-mono text-[11px] text-zinc-600 dark:text-zinc-400 max-w-xs">
                        {row.payload}
                      </td>
                      <td className="py-3 px-4 align-top font-mono text-[11px] text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {row.returns}
                      </td>
                      <td className="py-3 px-4 align-top text-zinc-600 dark:text-zinc-300 max-w-sm leading-relaxed">
                        <div>{row.description}</div>
                        <div className="font-mono text-[10.5px] text-zinc-500 mt-1">
                          Scope: {row.permissionScope}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Project Structure */}
        {activeSubTab === 'structure' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <span className="font-mono text-xs text-zinc-300">
                  Структура репозитория Tauri 2.0 (Frontend + Backend)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('tree', PROJECT_FOLDER_STRUCTURE)}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  {copiedId === 'tree' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'tree' ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>
              <pre className="p-4 font-mono text-xs leading-6 overflow-x-auto text-zinc-200">
                {PROJECT_FOLDER_STRUCTURE}
              </pre>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5">
                <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-zinc-500" />
                  Критические Rust-крейты (Cargo.toml)
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">tauri-plugin-shell</span>
                    <span className="text-zinc-500"> · </span>
                    <span className="text-zinc-600 dark:text-zinc-400">Запуск sidecar llama-server.exe и подтверждённых команд PowerShell/cmd.</span>
                  </div>
                  <div>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">reqwest + tokio</span>
                    <span className="text-zinc-500"> · </span>
                    <span className="text-zinc-600 dark:text-zinc-400">Асинхронная загрузка GGUF с HTTP Range и SSE-стриминг инференса.</span>
                  </div>
                  <div>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">sha2</span>
                    <span className="text-zinc-500"> · </span>
                    <span className="text-zinc-600 dark:text-zinc-400">Потоковая верификация LFS SHA256 без загрузки файла целиком в RAM.</span>
                  </div>
                  <div>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">rusqlite (bundled)</span>
                    <span className="text-zinc-500"> · </span>
                    <span className="text-zinc-600 dark:text-zinc-400">Локальная БД истории чатов, индекса моделей и Checkpoints.</span>
                  </div>
                  <div>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">similar + notify</span>
                    <span className="text-zinc-500"> · </span>
                    <span className="text-zinc-600 dark:text-zinc-400">Вычисление unified-диффов на стороне Rust и отслеживание изменений файлов проекта.</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5">
                <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Windows-first оптимизация памяти
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Использование системного Edge WebView2 (уже встроенного в Windows 10/11) позволяет избежать упаковки Chromium (~120 МБ) и удержать потребление RAM интерфейса в пределах 25–45 МБ, отдавая весь запас VRAM и ОЗУ под веса GGUF и KV-кэш.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Roadmap */}
        {activeSubTab === 'roadmap' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROADMAP_STAGES.map((stage) => (
              <div
                key={stage.phase}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-mono text-blue-600 dark:text-blue-400">
                    {stage.phase}
                  </div>
                  <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                    {stage.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Цель: {stage.target}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    {stage.deliverables.map((d, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        <span className="text-zinc-400 mt-0.5">·</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2 text-xs">
                  <div className="font-mono text-[11px] text-zinc-500">
                    Зависимости: {stage.dependencies.join(' · ')}
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-900 dark:text-zinc-200">Снижение рисков: </span>
                    {stage.riskMitigation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: Production Code Snippets */}
        {activeSubTab === 'code' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CODE_SNIPPETS.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  onClick={() => setActiveSnippetId(snippet.id)}
                  className={cn(
                    'px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
                    activeSnippetId === snippet.id
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700',
                  )}
                >
                  {snippet.title}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <div>
                  <div className="font-mono text-xs font-semibold text-zinc-100">
                    {activeSnippet.filename}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {activeSnippet.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(activeSnippet.id, activeSnippet.code)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedId === activeSnippet.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копировать код</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 font-mono text-xs leading-6 overflow-x-auto max-h-[540px] overflow-y-auto text-zinc-200">
                {activeSnippet.code}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
