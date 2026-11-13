import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  BookmarkPlus,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Container,
  Eye,
  FileText,
  FolderOpen,
  Globe,
  History,
  Laptop,
  MessageSquare,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  Terminal,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react';
import { OPENKOVA_SLASH_COMMANDS } from '../../data/openKovaSeed';
import { useKovaStore } from '../../store/useKovaStore';
import type { ExecutionEnvKind } from '../../types/kova';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { GitDiffViewer } from '../agent/GitDiffViewer';
import { MarkdownLite } from '../agent/MarkdownLite';
import { TerminalBlock } from '../agent/TerminalBlock';

const QUICK_PROMPTS = [
  '/search function',
  '/git status',
  '/run ls -la',
  '/web документация TypeScript',
  '/undo',
];

const ENV_META: { id: ExecutionEnvKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'local', label: 'Локально', icon: Laptop },
  { id: 'ssh', label: 'SSH', icon: Server },
  { id: 'docker', label: 'Docker', icon: Container },
];

export const CenterAgentPane: React.FC = () => {
  const {
    projects,
    activeProjectId,
    projectLogs,
    undoLastProjectAction,
    createOrWriteProjectFile,
    sessions,
    activeSessionId,
    agentMode,
    setAgentMode,
    centerPaneMode,
    setCenterPaneMode,
    files,
    selectedFilePath,
    checkpoints,
    sendPrompt,
    applyDiff,
    rejectDiff,
    runCommand,
    skipCommand,
    diagnoseCommandError,
    rollbackToCheckpoint,
    localModels,
    activeModelId,
    roles,
    activeRoleId,
    setActiveRole,
    setActiveTab,
    openSettingsSection,
    serverStatus,
    inferenceSettings,
    includeProjectTree,
    includeTerminalOutput,
    chatVisibility,
    uiStyle,
    freeProviders,
    activeProviderId,
    executionEnv,
    setActiveExecutionEnv,
    learnSkillFromMessage,
    launchSubagent,
  } = useKovaStore();

  const tokens = getUiTokens(uiStyle);
  const [input, setInput] = useState('');
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false);
  const [editingFile, setEditingFile] = useState(false);
  const [fileDraft, setFileDraft] = useState('');
  const [fileSaveMsg, setFileSaveMsg] = useState<string | null>(null);

  const streamEndRef = useRef<HTMLDivElement>(null);
  const cpRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const selectedFile = files.find((f) => f.path === selectedFilePath) ?? files[0];
  const activeModel = localModels.find((m) => m.id === activeModelId);
  const activeRole = roles.find((r) => r.id === activeRoleId) ?? roles[0];
  const activeProvider =
    freeProviders.find((p) => p.id === activeProviderId) ?? freeProviders[0];
  const latestCheckpoint = checkpoints[0];
  const hasUndoableAction = projectLogs.some((l) => !l.undone && l.kind === 'file_write');

  const includedTokens =
    files.filter((f) => f.inContext).reduce((acc, f) => acc + f.tokensEstimate, 0) +
    (includeProjectTree ? 180 : 0) +
    (includeTerminalOutput ? 120 : 0);
  const ctxPct = Math.min(100, Math.round((includedTokens / inferenceSettings.contextSize) * 100));

  const showSlashPopup = input.startsWith('/') && !input.includes(' ');
  const matchingSlash = OPENKOVA_SLASH_COMMANDS.filter((c) =>
    c.command.startsWith(input.toLowerCase()),
  );

  useEffect(() => {
    setEditingFile(false);
    setFileSaveMsg(null);
    if (selectedFile) {
      setFileDraft(selectedFile.content);
    }
  }, [selectedFilePath, selectedFile?.content]);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages.length, activeSession?.messages.at(-1)?.content]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (checkpointMenuOpen && cpRef.current && !cpRef.current.contains(e.target as Node)) {
        setCheckpointMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [checkpointMenuOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    void sendPrompt(input);
    setInput('');
  };

  const handleSaveEditedFile = async () => {
    if (!selectedFile) return;
    const res = await createOrWriteProjectFile(
      selectedFile.path,
      fileDraft,
      `Ручное редактирование ${selectedFile.path}`,
    );
    if (res.ok) {
      setEditingFile(false);
      setFileSaveMsg('Сохранено на диск');
    } else {
      setFileSaveMsg(res.error || 'Ошибка записи');
    }
  };

  return (
    <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Sub-toolbar */}
      {chatVisibility.showToolbar && (
        <div className={cn('min-h-12 shrink-0 px-4 py-1.5 border-b flex flex-wrap items-center justify-between gap-2.5', tokens.headerBg)}>
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className={cn('inline-flex items-center p-0.5 bg-zinc-200/75 dark:bg-zinc-800/90', tokens.inputRadius)}>
              <button
                type="button"
                onClick={() => setAgentMode('plan')}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                  tokens.inputRadius,
                  agentMode === 'plan'
                    ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                )}
              >
                Plan (Чтение)
              </button>
              <button
                type="button"
                onClick={() => setAgentMode('act')}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                  tokens.inputRadius,
                  agentMode === 'act'
                    ? tokens.accentButton
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                )}
              >
                Act (Диффы)
              </button>
            </div>

            <div className={cn('inline-flex items-center p-0.5 bg-zinc-200/75 dark:bg-zinc-800/90', tokens.inputRadius)}>
              <button
                type="button"
                onClick={() => setCenterPaneMode('chat')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0',
                  tokens.inputRadius,
                  centerPaneMode === 'chat'
                    ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Чат агента</span>
              </button>
              <button
                type="button"
                onClick={() => setCenterPaneMode('file')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0',
                  tokens.inputRadius,
                  centerPaneMode === 'file'
                    ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span className="truncate max-w-[140px]">{selectedFile?.name ?? 'Код'}</span>
              </button>
            </div>

            {chatVisibility.showExecutionEnvBar && (
              <div
                className={cn('hidden xl:inline-flex items-center p-0.5 bg-zinc-200/75 dark:bg-zinc-800/90', tokens.inputRadius)}
                title="Среда выполнения команд OpenKova"
              >
                {ENV_META.map((env) => {
                  const Icon = env.icon;
                  const active = executionEnv.activeEnv === env.id;
                  return (
                    <button
                      key={env.id}
                      type="button"
                      onClick={() => setActiveExecutionEnv(env.id)}
                      className={cn(
                        'px-2 py-1 text-[11px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap',
                        tokens.inputRadius,
                        active
                          ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{env.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasUndoableAction && (
              <button
                type="button"
                onClick={() => void undoLastProjectAction()}
                title="Откатить последнее изменение файла на диске"
                className={cn(
                  'h-8 px-2.5 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                  tokens.inputRadius,
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setInput('/web ')}
              title="Найти и прочитать публичные веб-страницы"
              className={cn(
                'h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                tokens.inputRadius,
              )}
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Браузер</span>
            </button>

            <button
              type="button"
              onClick={() => setInput('/run ')}
              title="Подготовить команду для терминала проекта"
              className={cn(
                'h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                tokens.inputRadius,
              )}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Терминал</span>
            </button>

            <button
              type="button"
              onClick={() =>
                launchSubagent({
                  prompt: `Аудит текущего контекста (${activeProject?.name ?? 'ONE CORE AI'})`,
                })
              }
              title="Запустить параллельного субагента"
              className={cn(
                'h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                tokens.inputRadius,
              )}
            >
              <Bot className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden md:inline">Субагент</span>
            </button>

            <button
              type="button"
              onClick={() => openSettingsSection('ui-chat')}
              title="Настроить видимые области чата и стиль интерфейса"
              className={cn(
                'h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                tokens.inputRadius,
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Области и стиль</span>
            </button>

            <div className="relative" ref={cpRef}>
              <button
                type="button"
                onClick={() => setCheckpointMenuOpen((v) => !v)}
                className={cn(
                  'h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                  tokens.inputRadius,
                )}
              >
                <History className="w-3.5 h-3.5 text-zinc-500" />
                <span>Checkpoints</span>
                <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                  ({checkpoints.length})
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {checkpointMenuOpen && (
                <div className={cn('absolute right-0 mt-2 w-80 border shadow-xl p-3 z-40', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Снапшоты проекта
                    </span>
                    <span className="text-[11px] text-zinc-500">Локальный откат</span>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {checkpoints.length === 0 ? (
                      <div className="text-xs text-zinc-500 py-2">
                        Снапшоты появятся при записи файлов через диффы. Для файловых действий также работает /undo.
                      </div>
                    ) : (
                      checkpoints.map((cp, idx) => (
                        <div
                          key={cp.id}
                          className={cn('p-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-start justify-between gap-2', tokens.cardRadius)}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {cp.label}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                              <span className="font-mono">{cp.id}</span> ·{' '}
                              <span className="font-mono tabular-nums">{cp.timestamp}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void rollbackToCheckpoint(cp.id);
                              setCheckpointMenuOpen(false);
                            }}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1 shrink-0 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{idx === 0 ? 'Откат' : 'Восст.'}</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Banner */}
      {chatVisibility.showTaskBanner && centerPaneMode === 'chat' && (
        <div className={cn('px-4 py-2 border-b text-xs flex flex-wrap items-center justify-between gap-2', tokens.taskBannerBg)}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
              {uiStyle === 'cyber-terminal' ? '> PROJECT:' : 'Проект:'}
            </span>
            {activeProject ? (
              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {activeProject.name}{' '}
                <span className="font-mono text-[11px] text-zinc-500">
                  ({activeProject.folderPath})
                </span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('kova:open-project-modal'))}
                className="text-amber-600 dark:text-amber-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Не подключена папка — выбрать проект</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
            <button
              type="button"
              onClick={() => openSettingsSection('providers')}
              className="hover:text-blue-500 transition-colors truncate max-w-[180px]"
              title="Переключить провайдер"
            >
              {activeModel ? activeModel.name : activeProvider.selectedModel}
            </button>
            <span>·</span>
            <span>Среда: {executionEnv.activeEnv}</span>
            <span>·</span>
            <span>
              {includedTokens} / {inferenceSettings.contextSize} ({ctxPct}%)
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area: Chat OR Real File Preview/Editor */}
      {centerPaneMode === 'file' && selectedFile ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
                {selectedFile.path}
              </span>
              <span className="text-zinc-400">·</span>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                ~{selectedFile.tokensEstimate} tok
              </span>
              {fileSaveMsg && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  · {fileSaveMsg}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {editingFile ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFile(false);
                      setFileDraft(selectedFile.content);
                    }}
                    className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveEditedFile()}
                    className="px-2.5 py-1 rounded bg-blue-600 text-white font-medium inline-flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    <span>Сохранить на диск</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFileDraft(selectedFile.content);
                    setEditingFile(true);
                  }}
                  className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-blue-500"
                >
                  Редактировать
                </button>
              )}
              <button
                type="button"
                onClick={() => setCenterPaneMode('chat')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Вернуться в чат
              </button>
            </div>
          </div>

          {editingFile ? (
            <textarea
              value={fileDraft}
              onChange={(e) => setFileDraft(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-xs leading-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none"
            />
          ) : (
            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-6">
              {selectedFile.content.split('\n').map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-10 pr-3 text-right select-none text-zinc-400 dark:text-zinc-600 tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  <pre className="whitespace-pre text-zinc-800 dark:text-zinc-200">{line}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className={cn('max-w-2xl mx-auto my-8 p-6 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>ONE CORE AI · Реальная работа с файлами, Git и терминалом</span>
              </div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {activeProject
                  ? `Проект «${activeProject.name}» (${agentMode === 'plan' ? 'Plan' : 'Act'})`
                  : 'Подключите папку проекта для начала работы'}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                {activeProject
                  ? 'Все команды и правки выполняются непосредственно в подключённой папке проекта с журналированием и поддержкой /undo.'
                  : 'Выберите локальную папку, SSH-сервер или GitHub репозиторий. Агент сможет читать/писать файлы, выполнять команды и работать с Git.'}
              </p>

              {!activeProject ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('kova:open-project-modal'))}
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Создать / подключить проект</span>
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendPrompt(q)}
                      className={cn('text-left px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-500/50 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors', tokens.cardRadius)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSession?.messages.map((msg) => (
            <div
              key={msg.id}
              aria-label={msg.role === 'user' ? 'Сообщение пользователя' : 'Ответ агента'}
              className={cn(
                'max-w-3xl mx-auto border border-l-[3px] p-4 shadow-sm',
                tokens.cardRadius,
                msg.role === 'user' ? tokens.userBubbleBg : tokens.assistantBubbleBg,
                msg.role === 'user' ? 'border-l-blue-500' : 'border-l-violet-500',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 font-semibold',
                      msg.role === 'user'
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-violet-700 dark:text-violet-300',
                    )}
                  >
                    {msg.role === 'user' ? (
                      <UserCheck className="w-3.5 h-3.5" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                    {msg.role === 'user' ? 'Вы' : 'Кова'}
                  </span>
                  {chatVisibility.showMessageHeaders && (
                    <>
                      {msg.role === 'assistant' && (
                        <>
                          <span>·</span>
                          <span className="text-zinc-600 dark:text-zinc-300">
                            {msg.providerLabel ?? activeModel?.name ?? 'Агент проекта'}
                          </span>
                        </>
                      )}
                      {msg.role === 'assistant' && msg.roleName && (
                        <>
                          <span>·</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {msg.roleName}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span className="font-mono">{msg.mode === 'plan' ? 'Plan' : 'Act'}</span>
                      {chatVisibility.showCheckpointBadges && msg.checkpointId && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            {msg.checkpointId}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
                {chatVisibility.showTimestamps && (
                  <span className="font-mono tabular-nums text-[11px]">{msg.timestamp}</span>
                )}
              </div>

              {chatVisibility.showReadFilesChips && msg.readFiles && msg.readFiles.length > 0 && (
                <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  <Eye className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="font-mono text-[11px]">read_file:</span>
                  {msg.readFiles.map((rf, i) => (
                    <React.Fragment key={rf}>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">{rf}</span>
                      {i < msg.readFiles!.length - 1 && <span>·</span>}
                    </React.Fragment>
                  ))}
                </div>
              )}

              <MarkdownLite content={msg.content} />

              {msg.webSources && msg.webSources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70">
                  <div className="mb-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Источники
                  </div>
                  <div className="flex flex-col gap-1">
                    {msg.webSources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {source.title || source.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {msg.subagentRun && chatVisibility.showSubagentsPanel && (
                <div className={cn('mt-3 p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 space-y-1.5', tokens.cardRadius)}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-blue-500" />
                      <span>{msg.subagentRun.title}</span>
                    </span>
                    <span
                      className={cn(
                        'font-mono tabular-nums text-[11px]',
                        msg.subagentRun.status === 'failed'
                          ? 'text-rose-500'
                          : 'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {msg.subagentRun.status === 'completed'
                        ? 'Завершён 100%'
                        : msg.subagentRun.status === 'failed'
                          ? 'Ошибка'
                          : `Выполняется ${msg.subagentRun.progressPct}%`}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        msg.subagentRun.status === 'completed'
                          ? 'bg-emerald-500'
                          : msg.subagentRun.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-blue-600',
                      )}
                      style={{ width: `${msg.subagentRun.progressPct}%` }}
                    />
                  </div>
                  <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {msg.subagentRun.resultSummary}
                  </p>
                </div>
              )}

              {msg.isStreaming && (
                <div className="mt-2 text-xs font-mono text-blue-600 dark:text-blue-400">
                  Выполнение запроса...
                </div>
              )}

              {chatVisibility.showDiffBlocks && msg.diff && (
                <GitDiffViewer
                  diff={msg.diff}
                  onApply={() => void applyDiff(msg.id)}
                  onReject={() => rejectDiff(msg.id)}
                  onRollback={(cpId) => void rollbackToCheckpoint(cpId)}
                />
              )}

              {chatVisibility.showTerminalBlocks && msg.command && (
                <TerminalBlock
                  command={msg.command}
                  onRun={() => void runCommand(msg.id)}
                  onSkip={() => skipCommand(msg.id)}
                  onDiagnose={() => diagnoseCommandError(msg.id)}
                />
              )}

              {msg.role === 'assistant' && !msg.isStreaming && !msg.subagentRun && (
                <div className="mt-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-end">
                  <button
                    type="button"
                    disabled={msg.skillLearned}
                    onClick={() => learnSkillFromMessage(msg.id)}
                    className={cn(
                      'text-[11px] font-medium inline-flex items-center gap-1 transition-colors',
                      msg.skillLearned
                        ? 'text-emerald-600 dark:text-emerald-400 cursor-default'
                        : 'text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400',
                    )}
                  >
                    {msg.skillLearned ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Сохранено в SKILL.md</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3 h-3" />
                        <span>Сохранить как навык</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={streamEndRef} />
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className={cn('shrink-0 border-t p-3.5 relative', tokens.headerBg)}
      >
        <div className="max-w-3xl mx-auto relative">
          {showSlashPopup && matchingSlash.length > 0 && (
            <div className={cn('absolute bottom-full left-0 right-0 mb-2 border shadow-xl p-2 z-30 space-y-1', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="px-2 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Команды проекта и OpenKova (нажмите для подстановки)
              </div>
              {matchingSlash.map((item) => (
                <button
                  key={item.command}
                  type="button"
                  onClick={() => setInput(`${item.command} `)}
                  className={cn('w-full text-left px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between gap-3 text-xs transition-colors', tokens.inputRadius)}
                >
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                    {item.syntax}
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400 truncate">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          )}

          {(chatVisibility.showRoleSwitcher || chatVisibility.showComposerStatusRow) && (
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              {chatVisibility.showRoleSwitcher ? (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1 shrink-0 mr-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    Роль:
                  </span>
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setActiveRole(r.id)}
                      className={cn(
                        'px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors border',
                        tokens.inputRadius,
                        r.id === activeRole.id
                          ? tokens.activeHighlight
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700',
                      )}
                    >
                      {r.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveTab('roles')}
                    className="px-2 py-1 text-[11px] text-zinc-500 hover:text-blue-500 whitespace-nowrap"
                  >
                    + Правила
                  </button>
                </div>
              ) : (
                <span />
              )}

              {chatVisibility.showComposerStatusRow && latestCheckpoint && (
                <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap tabular-nums">
                  {includedTokens} tok · {latestCheckpoint.id}
                </span>
              )}
            </div>
          )}

          {chatVisibility.showQuickPrompts && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2 overflow-x-auto">
              {QUICK_PROMPTS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void sendPrompt(q)}
                  className={cn('px-2.5 py-1 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 hover:border-blue-500/50 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap transition-colors', tokens.inputRadius)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className={cn('flex items-end gap-2 border border-zinc-300 dark:border-zinc-700/80 bg-white dark:bg-zinc-950 p-2 focus-within:border-blue-500 transition-colors', tokens.cardRadius)}>
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                agentMode === 'plan'
                  ? 'Опишите задачу или введите / (/search, /git, /run, /undo)...'
                  : 'Поставьте задачу в папке проекта или введите / (/run, /git, /search, /undo)...'
              }
              className="flex-1 resize-none bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none px-1.5 py-1"
            />
            <button
              type="submit"
              disabled={!input.trim() || serverStatus === 'generating'}
              className={cn('h-9 px-3.5 disabled:opacity-45 disabled:pointer-events-none text-xs font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap', tokens.inputRadius, tokens.accentButton)}
            >
              <span>Отправить</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
