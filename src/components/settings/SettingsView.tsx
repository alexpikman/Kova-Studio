import React, { useState } from 'react';
import {
  Brain,
  Check,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  Github,
  KeyRound,
  Keyboard,
  LayoutGrid,
  MessageCircle,
  Palette,
  RotateCcw,
  Server,
  Shield,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useKovaStore } from '../../store/useKovaStore';
import type {
  ChatVisibilitySettings,
  GpuBackend,
  SettingsSectionId,
  UiStylePreset,
} from '../../types/kova';
import { cn } from '../../utils/cn';
import { UI_STYLE_META, getUiTokens } from '../../utils/uiStyle';
import { OpenKovaSettingsSections } from './OpenKovaSettingsSections';
import { SshGithubView } from './SshGithubView';

interface VisibilityToggleGroup {
  title: string;
  items: { key: keyof ChatVisibilitySettings; label: string; hint: string }[];
}

const VISIBILITY_GROUPS: VisibilityToggleGroup[] = [
  {
    title: 'Левая боковая панель',
    items: [
      { key: 'showLeftSidebar', label: 'Показывать левую панель целиком', hint: 'Скрывает весь левый столбец для расширения чата' },
      { key: 'showProjectTree', label: 'Дерево файлов проекта', hint: 'Навигация по исходникам Rust и TypeScript' },
      { key: 'showLocalModels', label: 'Список локальных моделей GGUF', hint: 'Быстрое переключение активной модели' },
      { key: 'showSessionHistory', label: 'История чат-сессий', hint: 'Сохранённые задачи, поиск и кнопка нового чата' },
      { key: 'showSkillsMemoryTab', label: 'Вкладка «Навыки и память» (OpenKova)', hint: 'Переключатель SKILL.md и файлов SOUL/MEMORY/USER' },
    ],
  },
  {
    title: 'Правая панель инспектора',
    items: [
      { key: 'showRightInspector', label: 'Показывать правый инспектор целиком', hint: 'Расширяет область чтения кода и диффов' },
      { key: 'showMascot', label: 'Анимированный SVG-персонаж', hint: 'Реагирует на генерацию и активную роль' },
      { key: 'showTelemetry', label: 'Статус llama-server.exe и VRAM/RAM', hint: 'Кнопка Стоп/Запуск и индикаторы памяти' },
      { key: 'showFreeProviderCard', label: 'Селектор бесплатного провайдера ИИ', hint: 'Быстрое переключение llama.cpp / OpenRouter :free / Ollama' },
      { key: 'showInferenceControls', label: 'Параметры генерации (Temp, n_ctx, GPU)', hint: 'Быстрая настройка слоёв и контекста' },
      { key: 'showSubagentsPanel', label: 'Панель субагентов и делегирования', hint: 'Запуск параллельных воркеров и их карточки в чате' },
      { key: 'showActiveContext', label: 'Активный контекст и чекбоксы файлов', hint: 'Подсчёт токенов по открытым файлам' },
    ],
  },
  {
    title: 'Области потока чата (Cline-стиль)',
    items: [
      { key: 'showToolbar', label: 'Верхняя панель инструментов (Plan / Act / Код)', hint: 'Переключение режима и выпадающий список Checkpoints' },
      { key: 'showExecutionEnvBar', label: 'Переключатель среды (Локально / SSH / Docker)', hint: 'Выбор бэкенда выполнения команд в тулбаре' },
      { key: 'showTaskBanner', label: 'Панель задачи Cline (токены, прогресс, модель)', hint: 'Компактная строка состояния текущей задачи' },
      { key: 'showMessageHeaders', label: 'Заголовки сообщений (модель, роль, режим)', hint: 'Автор, активная роль и бейдж Plan/Act' },
      { key: 'showTimestamps', label: 'Временные метки сообщений', hint: 'Время отправки HH:MM:SS' },
      { key: 'showReadFilesChips', label: 'Блоки прочитанных файлов (read_file)', hint: 'Список файлов, проанализированных агентом' },
      { key: 'showDiffBlocks', label: 'Встроенные Git-диффы (replace_in_file)', hint: 'Интерактивное принятие и откат изменений' },
      { key: 'showTerminalBlocks', label: 'Блоки терминала PowerShell (execute_command)', hint: 'Запуск команд и диагностика ошибок' },
      { key: 'showCheckpointBadges', label: 'Бейджи Checkpoints в сообщениях', hint: 'Идентификатор снапшота SQLite' },
    ],
  },
  {
    title: 'Область ввода (Composer)',
    items: [
      { key: 'showRoleSwitcher', label: 'Быстрый переключатель ролей над полем ввода', hint: 'Разработчик, Архитектор, Ревьюер, QA' },
      { key: 'showQuickPrompts', label: 'Кнопки быстрых сценариев', hint: 'Пресеты промптов для мгновенного старта' },
      { key: 'showComposerStatusRow', label: 'Строка статуса токенов и активного снапшота', hint: 'Индикатор контекста и последнего Checkpoint' },
    ],
  },
];

const SETTINGS_TABS: { id: SettingsSectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ui-chat', label: 'Интерфейс и области чата', icon: LayoutGrid },
  { id: 'providers', label: 'Бесплатные провайдеры ИИ', icon: Sparkles },
  { id: 'skills-memory', label: 'Навыки, память и субагенты', icon: Brain },
  { id: 'execution-env', label: 'Среды: Local / SSH / Docker', icon: Server },
  { id: 'gateway', label: 'Шлюз мессенджеров', icon: MessageCircle },
  { id: 'engine-paths', label: 'Движок, пути и профили', icon: Sliders },
  { id: 'ssh-github', label: 'Доступ SSH и GitHub', icon: KeyRound },
  { id: 'github-download', label: 'Скачивание с GitHub', icon: Download },
];

export const SettingsView: React.FC = () => {
  const {
    settingsSection,
    setSettingsSection,
    uiStyle,
    setUiStyle,
    chatVisibility,
    updateChatVisibility,
    applyChatLayoutPreset,
    appSettings,
    updateAppSettings,
    inferenceSettings,
    updateInferenceSettings,
    githubAccess,
    updateGitHubAccess,
    setActiveTab,
  } = useKovaStore();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tokens = getUiTokens(uiStyle);

  const visibleCount = Object.values(chatVisibility).filter(Boolean).length;
  const totalCount = Object.keys(chatVisibility).length;

  const cleanRepo =
    githubAccess.repoOwnerSlashName.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') ||
    'alexpikman/Kova-Studio';
  const installPs1Cmd = `irm "https://raw.githubusercontent.com/${cleanRepo}/${githubAccess.defaultBranch || 'main'}/scripts/install.ps1" | iex`;
  const cloneAndRunCmd = `git clone https://github.com/${cleanRepo}.git\ncd Kova-Studio\nnpm install --legacy-peer-deps\nnpm run dev`;

  const copyText = (id: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
      {/* Left Settings Category Navigation */}
      <aside className={cn('w-full lg:w-[270px] shrink-0 border-b lg:border-b-0 lg:border-r p-4 flex flex-col gap-4', tokens.sidebarBg)}>
        <div>
          <h1 className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
            Все настройки
          </h1>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
            Единый центр конфигурации интерфейса, движка llama.cpp, SSH и GitHub.
          </p>
        </div>

        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto" aria-label="Разделы настроек">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = settingsSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSettingsSection(tab.id)}
                className={cn(
                  'px-3 py-2.5 text-left text-xs font-medium flex items-center gap-2.5 border transition-colors whitespace-nowrap shrink-0',
                  tokens.cardRadius,
                  active
                    ? tokens.activeHighlight
                    : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={cn('mt-auto hidden lg:block p-3 border text-xs space-y-2', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>Видимых областей чата</span>
            <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
              {visibleCount} / {totalCount}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Стиль: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{tokens.label}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('workstation')}
            className={cn('w-full h-8 text-xs font-medium transition-colors', tokens.cardRadius, tokens.accentButton)}
          >
            Открыть чат агента
          </button>
        </div>
      </aside>

      {/* Right Settings Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {settingsSection === 'ui-chat' && (
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
            {/* Section 1: 3 Interface Styles */}
            <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-blue-500" />
                    <span>3 варианта стиля интерфейса</span>
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Переключает плотность IDE, форму карточек, панель задачи Cline и акценты по всему приложению.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(Object.keys(UI_STYLE_META) as UiStylePreset[]).map((styleKey) => {
                  const meta = UI_STYLE_META[styleKey];
                  const selected = uiStyle === styleKey;
                  return (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => setUiStyle(styleKey)}
                      className={cn(
                        'p-4 border text-left transition-all flex flex-col justify-between gap-3',
                        meta.cardRadius,
                        selected
                          ? tokens.activeHighlight
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:border-zinc-400 dark:hover:border-zinc-600',
                      )}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {meta.label}
                          </span>
                          {selected && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                        </div>
                        <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {meta.subtitle}
                        </p>
                      </div>

                      {/* Mini visual preview strip */}
                      <div className={cn('p-2 border border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 bg-white dark:bg-zinc-950', meta.cardRadius)}>
                        <span className="w-3 h-5 bg-zinc-300 dark:bg-zinc-700 rounded-[2px]" />
                        <span className="flex-1 h-5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2px] flex items-center px-1.5">
                          <span
                            className={cn(
                              'w-8 h-1.5 rounded-full',
                              styleKey === 'cyber-terminal' ? 'bg-emerald-500' : 'bg-blue-500',
                            )}
                          />
                        </span>
                        <span className="w-3 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-[2px]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Quick Layout Presets */}
            <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-500" />
                    <span>Видимые области в чате и рабочей станции ({visibleCount} / {totalCount})</span>
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Включайте и отключайте любые панели, заголовки, диффы, терминал, маскота и подсказки ввода.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => applyChatLayoutPreset('full')}
                    className={cn('h-8 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5', tokens.cardRadius)}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Показать всё</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyChatLayoutPreset('cline-focus')}
                    className={cn('h-8 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200', tokens.cardRadius)}
                  >
                    Фокус Cline
                  </button>
                  <button
                    type="button"
                    onClick={() => applyChatLayoutPreset('minimal')}
                    className={cn('h-8 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200', tokens.cardRadius)}
                  >
                    Минимальный чат
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {VISIBILITY_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className={cn('p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 space-y-2.5', tokens.cardRadius)}
                  >
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
                      {group.title}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const checked = chatVisibility[item.key];
                        return (
                          <label
                            key={item.key}
                            className="flex items-start justify-between gap-3 py-1 cursor-pointer group"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {item.label}
                              </div>
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                {item.hint}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => updateChatVisibility({ [item.key]: e.target.checked })}
                              className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {settingsSection === 'engine-paths' && (
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
            <div className={cn('p-6 border space-y-6', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div>
                <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Локальный движок llama.cpp, пути и профиль железа
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Настройки хранения GGUF-весов, параметров GPU и горячих клавиш Windows.
                </p>
              </div>

              {/* Paths */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                  Пути хранения и бинарники
                </div>

                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    Каталог загруженных GGUF-моделей
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={appSettings.modelsDir}
                      onChange={(e) => updateAppSettings({ modelsDir: e.target.value })}
                      className={cn('flex-1 h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500', tokens.inputRadius)}
                    />
                    <button
                      type="button"
                      onClick={() => updateAppSettings({ modelsDir: '%APPDATA%\\KovaStudio\\models\\' })}
                      className={cn('px-3 h-9 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap', tokens.inputRadius)}
                    >
                      Сбросить
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    Путь к sidecar-бинарнику llama-server.exe
                  </label>
                  <input
                    type="text"
                    value={appSettings.llamaServerPath}
                    onChange={(e) => updateAppSettings({ llamaServerPath: e.target.value })}
                    className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500', tokens.inputRadius)}
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={appSettings.autoCheckSha256}
                    onChange={(e) => updateAppSettings({ autoCheckSha256: e.target.checked })}
                    className="accent-blue-600 rounded"
                  />
                  <span>Автоматически проверять SHA256 после завершения загрузки GGUF</span>
                </label>
              </div>

              {/* Hardware Profile */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                  Аппаратный профиль (для расчёта совместимости VRAM/RAM)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Бэкенд GPU</label>
                    <select
                      value={inferenceSettings.gpuBackend}
                      onChange={(e) =>
                        updateInferenceSettings({ gpuBackend: e.target.value as GpuBackend })
                      }
                      className={cn('w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100', tokens.inputRadius)}
                    >
                      <option value="auto">Авто (CUDA / Vulkan → CPU)</option>
                      <option value="cuda">NVIDIA CUDA</option>
                      <option value="vulkan">Vulkan 1.3</option>
                      <option value="cpu">CPU AVX2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Доступно VRAM (GB)</label>
                    <input
                      type="number"
                      min={2}
                      max={96}
                      step={2}
                      value={inferenceSettings.maxVramGb}
                      onChange={(e) =>
                        updateInferenceSettings({ maxVramGb: Math.max(2, Number(e.target.value) || 8) })
                      }
                      className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 tabular-nums', tokens.inputRadius)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Системная RAM (GB)</label>
                    <input
                      type="number"
                      min={8}
                      max={256}
                      step={4}
                      value={inferenceSettings.maxRamGb}
                      onChange={(e) =>
                        updateInferenceSettings({ maxRamGb: Math.max(8, Number(e.target.value) || 32) })
                      }
                      className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 tabular-nums', tokens.inputRadius)}
                    />
                  </div>
                </div>
              </div>

              {/* Cloud Fallback */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-500" />
                  Облачный fallback (опционально)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={appSettings.cloudFallbackProvider}
                    onChange={(e) =>
                      updateAppSettings({
                        cloudFallbackProvider: e.target.value as typeof appSettings.cloudFallbackProvider,
                      })
                    }
                    className={cn('h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100', tokens.inputRadius)}
                  >
                    <option value="none">Отключён (100% локально)</option>
                    <option value="openai">OpenAI Compatible</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                  <input
                    type="password"
                    disabled={appSettings.cloudFallbackProvider === 'none'}
                    value={appSettings.cloudFallbackKey}
                    onChange={(e) => updateAppSettings({ cloudFallbackKey: e.target.value })}
                    placeholder="Хранится в Windows Credential Manager..."
                    className={cn('sm:col-span-2 h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 disabled:opacity-45', tokens.inputRadius)}
                  />
                </div>
              </div>

              {/* Hotkeys */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mb-2.5">
                  <Keyboard className="w-3.5 h-3.5 text-zinc-500" />
                  Горячие клавиши Windows
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'Ctrl + Enter', desc: 'Отправить промпт агенту' },
                    { key: 'Ctrl + Shift + M', desc: 'Переключить Plan / Act' },
                    { key: 'Ctrl + K', desc: 'Открыть поиск моделей GGUF' },
                    { key: 'Ctrl + Alt + Z', desc: 'Откат к последнему Checkpoint' },
                  ].map((hk) => (
                    <div
                      key={hk.key}
                      className={cn('flex items-center justify-between px-3 py-2 border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40', tokens.cardRadius)}
                    >
                      <span className="text-zinc-600 dark:text-zinc-300">{hk.desc}</span>
                      <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
                        {hk.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {(settingsSection === 'providers' ||
          settingsSection === 'skills-memory' ||
          settingsSection === 'execution-env' ||
          settingsSection === 'gateway') && (
          <OpenKovaSettingsSections section={settingsSection} />
        )}

        {settingsSection === 'ssh-github' && <SshGithubView />}

        {settingsSection === 'github-download' && (
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
            <div className={cn('p-6 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Github className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                  <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Загрузка и запуск с GitHub ({cleanRepo})
                  </h2>
                </div>
                <a
                  href={`https://github.com/${cleanRepo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Открыть репозиторий</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Репозиторий (owner/repo)</label>
                  <input
                    type="text"
                    value={githubAccess.repoOwnerSlashName}
                    onChange={(e) => updateGitHubAccess({ repoOwnerSlashName: e.target.value })}
                    className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Ветка</label>
                  <input
                    type="text"
                    value={githubAccess.defaultBranch}
                    onChange={(e) => updateGitHubAccess({ defaultBranch: e.target.value })}
                    className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
                  />
                </div>
              </div>

              <div className={cn('p-3.5 bg-zinc-950 text-zinc-100 space-y-2', tokens.cardRadius)}>
                <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
                  <span>PowerShell 1-клик (без локальной сборки MSVC)</span>
                  <button
                    type="button"
                    onClick={() => copyText('ps1-cmd', installPs1Cmd)}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1"
                  >
                    {copiedId === 'ps1-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'ps1-cmd' ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs break-all select-all">{installPs1Cmd}</div>
              </div>

              <div className={cn('p-3.5 bg-zinc-950 text-zinc-100 space-y-2', tokens.cardRadius)}>
                <div className="flex items-center justify-between text-[11px] font-mono text-blue-400">
                  <span>Альтернатива: клонирование и запуск локально (без MSVC)</span>
                  <button
                    type="button"
                    onClick={() => copyText('git-cmd', cloneAndRunCmd)}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1"
                  >
                    {copiedId === 'git-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'git-cmd' ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                </div>
                <pre className="font-mono text-xs whitespace-pre-wrap">{cloneAndRunCmd}</pre>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`https://github.com/${cleanRepo}/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5', tokens.cardRadius)}
                >
                  <span>GitHub Releases (.exe / .msi)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={`https://github.com/${cleanRepo}/actions/workflows/build-windows.yml`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('h-9 px-3.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5', tokens.cardRadius)}
                >
                  <span>GitHub Actions (облачная сборка)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="/install.ps1"
                  download="install-kova-studio.ps1"
                  className={cn('h-9 px-3.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5', tokens.cardRadius)}
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Скачать install.ps1</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
