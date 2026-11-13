import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  Cpu,
  FileCode,
  FilePlus2,
  Folder,
  FolderCog,
  GitBranch,
  History,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useKovaStore } from '../../store/useKovaStore';
import type { AgentMemoryKey, ProjectRecord } from '../../types/kova';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';
import { ProjectModal } from './ProjectModal';

type SidebarSectionTab = 'workspace' | 'learning';

export const LeftSidebar: React.FC = () => {
  const {
    projects,
    activeProjectId,
    projectLogs,
    selectProject,
    createOrWriteProjectFile,
    runProjectGitAction,
    undoLastProjectAction,
    files,
    selectedFilePath,
    selectFile,
    localModels,
    activeModelId,
    selectLocalModel,
    sessions,
    activeSessionId,
    setActiveSession,
    createNewSession,
    setActiveTab,
    openSettingsSection,
    serverStatus,
    chatVisibility,
    uiStyle,
    skills,
    toggleSkill,
    memoryDocs,
    updateMemoryDoc,
  } = useKovaStore();

  const tokens = getUiTokens(uiStyle);
  const [sidebarTab, setSidebarTab] = useState<SidebarSectionTab>('workspace');
  const [sessionQuery, setSessionQuery] = useState('');
  const [activeMemKey, setActiveMemKey] = useState<AgentMemoryKey>('memory');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [treeActionFeedback, setTreeActionFeedback] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ '.': true });

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  useEffect(() => {
    const handler = () => {
      setEditingProject(null);
      setModalOpen(true);
    };
    window.addEventListener('kova:open-project-modal', handler);
    return () => window.removeEventListener('kova:open-project-modal', handler);
  }, []);

  const folders = Array.from(new Set(files.map((f) => f.folder || '.')));
  const activeMemDoc = memoryDocs.find((m) => m.key === activeMemKey) ?? memoryDocs[0];
  const enabledSkillsCount = skills.filter((s) => s.enabled).length;

  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (sess) =>
        sess.title.toLowerCase().includes(q) ||
        sess.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [sessions, sessionQuery]);

  const toggleFolder = (folder: string) => {
    setOpenFolders((prev) => ({ ...prev, [folder]: !(prev[folder] ?? true) }));
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;
    setTreeActionFeedback(null);
    const res = await createOrWriteProjectFile(
      newFilePath.trim(),
      newFileContent,
      `Создание файла ${newFilePath.trim()}`,
    );
    if (res.ok) {
      setNewFileOpen(false);
      setNewFilePath('');
      setNewFileContent('');
      setTreeActionFeedback('Файл записан на диск');
    } else {
      setTreeActionFeedback(res.error || 'Ошибка записи');
    }
  };

  const handleQuickGitStatus = async () => {
    setTreeActionFeedback(null);
    const res = await runProjectGitAction('status');
    const summary = (res.stdout || res.stderr || `exit ${res.exitCode}`).split('\n')[0];
    setTreeActionFeedback(`git status: ${summary}`);
  };

  const handleQuickUndo = async () => {
    const res = await undoLastProjectAction();
    setTreeActionFeedback(res.message);
  };

  return (
    <aside className={cn('w-full lg:w-[276px] xl:w-[296px] shrink-0 border-b lg:border-b-0 lg:border-r flex flex-col overflow-hidden', tokens.sidebarBg)}>
      {/* Segmented switcher: Workspace vs OpenKova Skills & Memory */}
      {chatVisibility.showSkillsMemoryTab && (
        <div className="px-3 pt-2.5 pb-2 border-b border-zinc-200 dark:border-zinc-800/90">
          <div className={cn('grid grid-cols-2 p-0.5 bg-zinc-200/75 dark:bg-zinc-800/90', tokens.inputRadius)}>
            <button
              type="button"
              onClick={() => setSidebarTab('workspace')}
              className={cn(
                'py-1.5 px-2 text-[11px] font-medium transition-colors whitespace-nowrap truncate',
                tokens.inputRadius,
                sidebarTab === 'workspace'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              )}
            >
              Проект и сессии
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('learning')}
              className={cn(
                'py-1.5 px-2 text-[11px] font-medium transition-colors whitespace-nowrap truncate inline-flex items-center justify-center gap-1',
                tokens.inputRadius,
                sidebarTab === 'learning'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              )}
            >
              <span>Навыки</span>
              <span className="font-mono tabular-nums text-[10px] opacity-75">({enabledSkillsCount})</span>
            </button>
          </div>
        </div>
      )}

      {sidebarTab === 'learning' && chatVisibility.showSkillsMemoryTab ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {/* OpenKova Self-Improving Skills */}
          <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>Навыки SKILL.md</span>
              </span>
              <button
                type="button"
                onClick={() => openSettingsSection('skills-memory')}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                <span>Управлять</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {skills.map((skill) => (
                <label
                  key={skill.id}
                  className={cn(
                    'flex items-start gap-2 p-2 border cursor-pointer transition-colors',
                    tokens.cardRadius,
                    skill.enabled
                      ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60'
                      : 'border-zinc-200/50 dark:border-zinc-800/40 opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={() => toggleSkill(skill.id)}
                    className="mt-0.5 accent-blue-600 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {skill.title}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-mono tabular-nums">
                      <span>{skill.source === 'learned' ? 'Авто-навык' : skill.category}</span>
                      <span>·</span>
                      <span>{skill.usageCount}x</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* OpenKova Persistent 3-Layer Memory */}
          <div className="p-3.5 flex-1 flex flex-col min-h-[240px] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-emerald-500" />
                <span>Память агента</span>
              </span>
              <span className="text-[10.5px] font-mono text-zinc-500">{activeMemDoc?.updatedAt}</span>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {memoryDocs.map((doc) => (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => setActiveMemKey(doc.key)}
                  className={cn(
                    'py-1 px-1.5 border font-mono text-[10.5px] transition-colors truncate',
                    tokens.inputRadius,
                    activeMemKey === doc.key
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400',
                  )}
                >
                  {doc.filename}
                </button>
              ))}
            </div>

            {activeMemDoc && (
              <div className="flex-1 flex flex-col gap-1.5 min-h-0">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                  {activeMemDoc.description}
                </div>
                <textarea
                  value={activeMemDoc.content}
                  onChange={(e) => updateMemoryDoc(activeMemDoc.key, e.target.value)}
                  className={cn(
                    'flex-1 min-h-[140px] w-full p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-200 resize-none focus:outline-none focus:border-blue-500',
                    tokens.inputRadius,
                  )}
                />
                <div className="text-[10.5px] text-zinc-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                  <span>Автоматически подмешивается в каждый промпт</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Section 1: Real Project Selector & File Tree */}
          {chatVisibility.showProjectTree && (
            <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/90 space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  Проект
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {activeProject && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProject(activeProject);
                        setModalOpen(true);
                      }}
                      title="Настроить или удалить проект"
                      className="p-1 rounded hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <FolderCog className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProject(null);
                      setModalOpen(true);
                    }}
                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Новый</span>
                  </button>
                </div>
              </div>

              {projects.length > 0 ? (
                <div className="space-y-1">
                  <select
                    value={activeProjectId}
                    onChange={(e) => void selectProject(e.target.value)}
                    className={cn(
                      'w-full h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-900 dark:text-zinc-100',
                      tokens.inputRadius,
                    )}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.folderSource})
                      </option>
                    ))}
                  </select>
                  {activeProject && (
                    <div
                      className="text-[10.5px] font-mono text-zinc-500 truncate"
                      title={activeProject.folderPath}
                    >
                      {activeProject.folderPath}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null);
                    setModalOpen(true);
                  }}
                  className={cn(
                    'w-full p-2.5 border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-center transition-colors',
                    tokens.cardRadius,
                  )}
                >
                  + Подключить папку проекта
                </button>
              )}

              {activeProject && (
                <>
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <span className="font-mono text-[10.5px] text-zinc-500 tabular-nums">
                      {files.length} файлов
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewFileOpen((v) => !v)}
                        title="Создать новый файл в папке проекта"
                        className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-[10.5px] text-zinc-600 dark:text-zinc-300 hover:border-blue-500 inline-flex items-center gap-1"
                      >
                        <FilePlus2 className="w-3 h-3" />
                        <span>Файл</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickGitStatus}
                        title="Выполнить git status"
                        className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-[10.5px] text-zinc-600 dark:text-zinc-300 hover:border-blue-500 inline-flex items-center gap-1"
                      >
                        <GitBranch className="w-3 h-3" />
                        <span>Git</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickUndo}
                        title="Откатить последнее изменение (/undo)"
                        className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-[10.5px] text-zinc-600 dark:text-zinc-300 hover:border-amber-500 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Откат</span>
                      </button>
                    </div>
                  </div>

                  {newFileOpen && (
                    <form onSubmit={handleCreateFile} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1.5">
                      <input
                        type="text"
                        value={newFilePath}
                        onChange={(e) => setNewFilePath(e.target.value)}
                        placeholder="например: hello.py"
                        className="w-full h-7 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-[11px]"
                      />
                      <textarea
                        rows={2}
                        value={newFileContent}
                        onChange={(e) => setNewFileContent(e.target.value)}
                        placeholder="Содержимое файла..."
                        className="w-full p-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-[11px] resize-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNewFileOpen(false)}
                          className="px-2 py-0.5 text-[11px] text-zinc-500"
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          disabled={!newFilePath.trim()}
                          className="px-2.5 py-0.5 rounded bg-blue-600 text-white text-[11px] font-medium disabled:opacity-45"
                        >
                          Записать
                        </button>
                      </div>
                    </form>
                  )}

                  {treeActionFeedback && (
                    <div className="text-[10.5px] font-mono text-blue-600 dark:text-blue-400 truncate" title={treeActionFeedback}>
                      {treeActionFeedback}
                    </div>
                  )}

                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {files.length === 0 ? (
                      <div className="text-[11px] text-zinc-500 py-2">
                        Папка проекта пуста. Создайте файл или поставьте задачу в чате.
                      </div>
                    ) : (
                      folders.map((folder) => {
                        const isOpen = openFolders[folder] ?? true;
                        const folderFiles = files.filter((f) => (f.folder || '.') === folder);

                        return (
                          <div key={folder}>
                            <button
                              type="button"
                              onClick={() => toggleFolder(folder)}
                              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors text-left"
                            >
                              {isOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              )}
                              <Folder className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                              <span className="font-mono text-[11.5px] truncate">{folder}</span>
                            </button>

                            {isOpen && (
                              <div className="ml-4 mt-0.5 space-y-0.5">
                                {folderFiles.map((file) => {
                                  const active = selectedFilePath === file.path;
                                  const modified = file.content !== file.originalContent;
                                  return (
                                    <button
                                      key={file.path}
                                      type="button"
                                      onClick={() => selectFile(file.path, true)}
                                      className={cn(
                                        'w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-xs transition-colors text-left',
                                        active
                                          ? 'bg-blue-600/10 text-blue-700 dark:text-blue-300 font-medium'
                                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50',
                                      )}
                                    >
                                      <span className="flex items-center gap-1.5 min-w-0">
                                        <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                        <span className="font-mono text-[11.5px] truncate">{file.name}</span>
                                      </span>
                                      <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                                        {modified ? 'M' : file.inContext ? 'CTX' : ''}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Collapsible Action Log */}
                  <div className="pt-1 border-t border-zinc-200/70 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setLogsExpanded((v) => !v)}
                      className="w-full flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>Журнал действий ({projectLogs.length})</span>
                      </span>
                      {logsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    {logsExpanded && (
                      <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto">
                        {projectLogs.length === 0 ? (
                          <div className="text-[10.5px] text-zinc-500">Записей пока нет</div>
                        ) : (
                          projectLogs.slice(0, 10).map((log) => (
                            <div key={log.id} className="text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center justify-between gap-1.5">
                              <span className={cn('truncate', log.undone && 'line-through opacity-60')}>
                                [{log.kind}] {log.summary}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Section 2: Local GGUF Models */}
          {chatVisibility.showLocalModels && (
            <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/90">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                  Локальные модели
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('models')}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" />
                  Управлять
                </button>
              </div>

              {localModels.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1.5">
                  Модели не загружены. Скачайте GGUF или импортируйте файл во вкладке «Модели GGUF».
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {localModels.map((model) => {
                    const isActive = model.id === activeModelId;
                    const isReady = model.status === 'ready';
                    return (
                      <button
                        key={model.id}
                        type="button"
                        disabled={!isReady}
                        onClick={() => void selectLocalModel(model.id)}
                        className={cn(
                          'w-full text-left p-2 border transition-colors',
                          tokens.cardRadius,
                          isActive
                            ? tokens.activeHighlight
                            : 'border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700',
                          !isReady && 'opacity-80 cursor-default',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {model.name}
                          </span>
                          <span
                            className={cn(
                              'font-mono text-[10px] shrink-0 tabular-nums',
                              model.status === 'corrupt' || model.status === 'error'
                                ? 'text-rose-500'
                                : 'text-zinc-500',
                            )}
                          >
                            {isActive && serverStatus === 'loading'
                              ? 'Загрузка...'
                              : isActive
                                ? 'Активна'
                                : isReady
                                  ? 'Готова'
                                  : model.status === 'corrupt'
                                    ? 'Битый SHA256'
                                    : model.status === 'error'
                                      ? 'Ошибка'
                                      : model.status === 'verifying'
                                        ? 'SHA256...'
                                        : `${model.progressPct}%`}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                          <span>{model.quant}</span>
                          <span>·</span>
                          <span>{model.sizeGb} GB</span>
                        </div>
                        {model.status === 'downloading' && (
                          <div className="mt-1.5 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all duration-200"
                              style={{ width: `${model.progressPct}%` }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Chat Sessions History */}
          {chatVisibility.showSessionHistory && (
            <div className="p-3.5 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-zinc-500" />
                  История сессий
                </span>
                <button
                  type="button"
                  onClick={createNewSession}
                  title="Новая сессия"
                  className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Новый чат</span>
                </button>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sessionQuery}
                  onChange={(e) => setSessionQuery(e.target.value)}
                  placeholder="Поиск по сессиям..."
                  className={cn(
                    'w-full h-7 pl-7 pr-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500',
                    tokens.inputRadius,
                  )}
                />
              </div>

              <div className="space-y-1 overflow-y-auto pr-1 flex-1">
                {filteredSessions.map((sess) => {
                  const active = sess.id === activeSessionId;
                  return (
                    <button
                      key={sess.id}
                      type="button"
                      onClick={() => setActiveSession(sess.id)}
                      className={cn(
                        'w-full text-left px-2.5 py-2 transition-colors border',
                        tokens.cardRadius,
                        active
                          ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                          : 'border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50',
                      )}
                    >
                      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {sess.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span>{sess.mode === 'plan' ? 'Plan' : 'Act'}</span>
                        <span>·</span>
                        <span>{sess.updatedAt}</span>
                        <span>·</span>
                        <span className="tabular-nums">{sess.messages.length} сообщ.</span>
                      </div>
                    </button>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <div className="text-[11px] text-zinc-500 py-3 text-center">
                    Совпадений в истории не найдено
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <ProjectModal
        open={modalOpen}
        editingProject={editingProject}
        onClose={() => setModalOpen(false)}
      />
    </aside>
  );
};
