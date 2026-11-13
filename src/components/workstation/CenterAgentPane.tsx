import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  Code2,
  Eye,
  FileText,
  History,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react';
import { useKovaStore } from '../../store/useKovaStore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { GitDiffViewer } from '../agent/GitDiffViewer';
import { MarkdownLite } from '../agent/MarkdownLite';
import { TerminalBlock } from '../agent/TerminalBlock';

const QUICK_PROMPTS = [
  'Добавь проверку HTTP 206 и очистку битого .part в model_manager.rs',
  'Проанализируй стратегию авто-детекта GPU без блокировки WebView2',
  'Проверь сборку через cargo check и диагностируй ошибки',
];

export const CenterAgentPane: React.FC = () => {
  const {
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
  } = useKovaStore();

  const tokens = getUiTokens(uiStyle);
  const [input, setInput] = useState('');
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false);
  const streamEndRef = useRef<HTMLDivElement>(null);
  const cpRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const selectedFile = files.find((f) => f.path === selectedFilePath) ?? files[0];
  const activeModel = localModels.find((m) => m.id === activeModelId);
  const activeRole = roles.find((r) => r.id === activeRoleId) ?? roles[0];
  const latestCheckpoint = checkpoints[0];

  const includedTokens =
    files.filter((f) => f.inContext).reduce((acc, f) => acc + f.tokensEstimate, 0) +
    (includeProjectTree ? 180 : 0) +
    (includeTerminalOutput ? 120 : 0);
  const ctxPct = Math.min(100, Math.round((includedTokens / inferenceSettings.contextSize) * 100));

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
    sendPrompt(input);
    setInput('');
  };

  return (
    <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Sub-toolbar: Plan/Act switch, Chat/Code view switch, Checkpoints, Layout Settings */}
      {chatVisibility.showToolbar && (
        <div className={cn('h-12 shrink-0 px-4 border-b flex items-center justify-between gap-3', tokens.headerBg)}>
          <div className="flex items-center gap-3 min-w-0">
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
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
                      Снапшоты состояния (SQLite)
                    </span>
                    <span className="text-[11px] text-zinc-500">Авто перед записью</span>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {checkpoints.map((cp, idx) => (
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
                            rollbackToCheckpoint(cp.id);
                            setCheckpointMenuOpen(false);
                          }}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1 shrink-0 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{idx === 0 ? 'Откат' : 'Восст.'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cline-style Task Banner */}
      {chatVisibility.showTaskBanner && centerPaneMode === 'chat' && (
        <div className={cn('px-4 py-2 border-b text-xs flex flex-wrap items-center justify-between gap-2', tokens.taskBannerBg)}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
              {uiStyle === 'cyber-terminal' ? '> TASK:' : 'Задача:'}
            </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {activeSession?.title ?? 'Локальная задача'}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
            <span>
              Контекст: {includedTokens} / {inferenceSettings.contextSize} ({ctxPct}%)
            </span>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400">$0.00 (Локально)</span>
          </div>
        </div>
      )}

      {/* Main Content Area: Chat OR Live File Code Preview */}
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
              {selectedFile.content !== selectedFile.originalContent && (
                <>
                  <span className="text-zinc-400">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Изменён диффом
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCenterPaneMode('chat')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
            >
              Вернуться в чат
            </button>
          </div>
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
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className={cn('max-w-2xl mx-auto my-8 p-6 border', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Локальная сессия без отправки кода в облако</span>
              </div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Готов к работе в режиме {agentMode === 'plan' ? 'Plan (анализ)' : 'Act (правки с подтверждением)'}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                Опишите задачу для проекта <span className="font-mono">Kova-Studio</span> или выберите сценарий ниже. Перед каждым изменением файла автоматически сохраняется Checkpoint.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendPrompt(q)}
                    className={cn('text-left px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-500/50 text-xs text-zinc-700 dark:text-zinc-300 transition-colors', tokens.cardRadius)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession?.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'max-w-3xl mx-auto border p-4',
                tokens.cardRadius,
                msg.role === 'user' ? tokens.userBubbleBg : tokens.assistantBubbleBg,
              )}
            >
              {(chatVisibility.showMessageHeaders || chatVisibility.showTimestamps) && (
                <div className="flex items-center justify-between gap-2 mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {chatVisibility.showMessageHeaders ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {msg.role === 'user' ? 'Вы' : activeModel?.name ?? 'Локальный агент'}
                      </span>
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
                    </div>
                  ) : (
                    <span />
                  )}

                  {chatVisibility.showTimestamps && (
                    <span className="font-mono tabular-nums text-[11px]">{msg.timestamp}</span>
                  )}
                </div>
              )}

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

              {msg.isStreaming && (
                <div className="mt-2 text-xs font-mono text-blue-600 dark:text-blue-400">
                  Генерация токенов через llama-server.exe...
                </div>
              )}

              {chatVisibility.showDiffBlocks && msg.diff && (
                <GitDiffViewer
                  diff={msg.diff}
                  onApply={() => applyDiff(msg.id)}
                  onReject={() => rejectDiff(msg.id)}
                  onRollback={rollbackToCheckpoint}
                />
              )}

              {chatVisibility.showTerminalBlocks && msg.command && (
                <TerminalBlock
                  command={msg.command}
                  onRun={(simErr) => runCommand(msg.id, simErr)}
                  onSkip={() => skipCommand(msg.id)}
                  onDiagnose={() => diagnoseCommandError(msg.id)}
                />
              )}
            </div>
          ))}
          <div ref={streamEndRef} />
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className={cn('shrink-0 border-t p-3.5', tokens.headerBg)}
      >
        <div className="max-w-3xl mx-auto">
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
                  onClick={() => sendPrompt(q)}
                  className={cn('px-2.5 py-1 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 hover:border-blue-500/50 text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap transition-colors', tokens.inputRadius)}
                >
                  {q.length > 42 ? `${q.slice(0, 42)}…` : q}
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
                  ? 'Опишите задачу для анализа архитектуры в режиме Plan...'
                  : 'Поставьте задачу агенту: например, «Усиль проверку SHA256 в model_manager.rs»...'
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
