import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  FileCode,
  Folder,
  History,
  MessageSquarePlus,
  Plus,
} from 'lucide-react';
import { useKovaStore } from '../../store/useKovaStore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';

export const LeftSidebar: React.FC = () => {
  const {
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
    serverStatus,
    chatVisibility,
    uiStyle,
  } = useKovaStore();

  const tokens = getUiTokens(uiStyle);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'src-tauri/src': true,
    'src-tauri': true,
    'src/stores': true,
  });

  const folders = Array.from(new Set(files.map((f) => f.folder)));

  const toggleFolder = (folder: string) => {
    setOpenFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  return (
    <aside className={cn('w-full lg:w-[272px] xl:w-[290px] shrink-0 border-b lg:border-b-0 lg:border-r flex flex-col overflow-hidden', tokens.sidebarBg)}>
      {/* Section 1: Project Tree */}
      {chatVisibility.showProjectTree && (
        <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/90">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Проект: Kova-Studio
            </span>
            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
              {files.length} файлов
            </span>
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {folders.map((folder) => {
              const isOpen = openFolders[folder] ?? true;
              const folderFiles = files.filter((f) => f.folder === folder);

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
            })}
          </div>
        </div>
      )}

      {/* Section 2: Local GGUF Models */}
      {chatVisibility.showLocalModels && (
        <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/90">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
              Модели GGUF
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('models')}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              Скачать
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {localModels.map((model) => {
              const isActive = model.id === activeModelId;
              const isReady = model.status === 'ready';
              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={!isReady}
                  onClick={() => selectLocalModel(model.id)}
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
                    <span className="font-mono text-[10px] text-zinc-500 shrink-0 tabular-nums">
                      {isActive && serverStatus === 'loading'
                        ? 'Загрузка...'
                        : isActive
                          ? 'Активна'
                          : isReady
                            ? 'Готова'
                            : model.status === 'verifying'
                              ? 'SHA256...'
                              : `${model.progressPct}%`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                    <span>{model.quant}</span>
                    <span>·</span>
                    <span>{model.sizeGb} GB</span>
                    <span>·</span>
                    <span>{model.minVramGb} GB VRAM</span>
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

          <div className="space-y-1 overflow-y-auto pr-1 flex-1">
            {sessions.map((sess) => {
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
          </div>
        </div>
      )}
    </aside>
  );
};
