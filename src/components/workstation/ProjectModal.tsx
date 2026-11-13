import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  KeyRound,
  Loader2,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import { useKovaStore, type SaveProjectPayload } from '../../store/useKovaStore';
import type { FsBrowseResult, ProjectFolderSource, ProjectRecord } from '../../types/kova';
import { cn } from '../../utils/cn';
import { apiFetch as fetch } from '../../utils/apiFetch';

interface ProjectModalProps {
  open: boolean;
  editingProject: ProjectRecord | null;
  onClose: () => void;
}

const TOOL_OPTIONS = [
  { id: 'read_file', label: 'Чтение файлов' },
  { id: 'write_file', label: 'Запись / Правка файлов' },
  { id: 'search_code', label: 'Поиск по коду' },
  { id: 'exec_command', label: 'Запуск команд (Shell)' },
  { id: 'git', label: 'Git операции' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({ open, editingProject, onClose }) => {
  const { localModels, freeProviders, saveProject, deleteProject } = useKovaStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folderSource, setFolderSource] = useState<ProjectFolderSource>('local');
  const [folderPath, setFolderPath] = useState('');
  const [allowedTools, setAllowedTools] = useState<string[]>([
    'read_file',
    'write_file',
    'search_code',
    'exec_command',
    'git',
  ]);
  const [defaultModelId, setDefaultModelId] = useState('');

  // SSH fields
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUser, setSshUser] = useState('');
  const [sshRemotePath, setSshRemotePath] = useState('');
  const [sshAuthType, setSshAuthType] = useState<'key' | 'agent' | 'password'>('key');
  const [sshKeyPath, setSshKeyPath] = useState('~/.ssh/id_ed25519');
  const [sshPassword, setSshPassword] = useState('');
  const [sshTestStatus, setSshTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sshTesting, setSshTesting] = useState(false);

  // GitHub fields
  const [ghRepo, setGhRepo] = useState('');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghAuthMethod, setGhAuthMethod] = useState<'public' | 'pat' | 'ssh'>('public');
  const [ghToken, setGhToken] = useState('');
  const [ghLocalClonePath, setGhLocalClonePath] = useState('');
  const [ghTestStatus, setGhTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ghTesting, setGhTesting] = useState(false);

  // Directory browser state
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseData, setBrowseData] = useState<FsBrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const [nativePickerNote, setNativePickerNote] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const browseTo = useCallback(async (targetPath?: string) => {
    setBrowseLoading(true);
    try {
      const qs = targetPath ? `?path=${encodeURIComponent(targetPath)}` : '';
      const res = await fetch(`/api/fs/browse${qs}`);
      const data = (await res.json()) as FsBrowseResult & { ok?: boolean; error?: string };
      setBrowseData(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка обзора папок');
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setNativePickerNote(null);
    setSshTestStatus(null);
    setGhTestStatus(null);
    setConfirmDelete(false);

    if (editingProject) {
      setName(editingProject.name);
      setDescription(editingProject.description || '');
      setFolderSource(editingProject.folderSource);
      setFolderPath(editingProject.folderPath);
      setAllowedTools(editingProject.allowedTools);
      setDefaultModelId(editingProject.defaultModelId || '');
      if (editingProject.sshConfig) {
        setSshHost(editingProject.sshConfig.host);
        setSshPort(editingProject.sshConfig.port);
        setSshUser(editingProject.sshConfig.user);
        setSshRemotePath(editingProject.sshConfig.remotePath);
        setSshAuthType(editingProject.sshConfig.authType);
        setSshKeyPath(editingProject.sshConfig.keyPath || '');
      }
      if (editingProject.githubConfig) {
        setGhRepo(editingProject.githubConfig.repo);
        setGhBranch(editingProject.githubConfig.branch);
        setGhAuthMethod(editingProject.githubConfig.authMethod);
        setGhLocalClonePath(editingProject.folderPath || '');
      }
    } else {
      setName('');
      setDescription('');
      setFolderSource('local');
      setFolderPath('');
      setAllowedTools(['read_file', 'write_file', 'search_code', 'exec_command', 'git']);
      setDefaultModelId('');
      setSshHost('');
      setSshPort(22);
      setSshUser('');
      setSshRemotePath('');
      setSshAuthType('key');
      setSshKeyPath('~/.ssh/id_ed25519');
      setSshPassword('');
      setGhRepo('');
      setGhBranch('main');
      setGhAuthMethod('public');
      setGhToken('');
      setGhLocalClonePath('');
    }
    setBrowseOpen(true);
    void browseTo(editingProject?.folderSource === 'local' ? editingProject.folderPath : undefined);
  }, [open, editingProject, browseTo]);

  if (!open) return null;

  const toggleTool = (toolId: string) => {
    setAllowedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  const handleCreateSubdir = async () => {
    if (!browseData?.currentPath || !newDirName.trim()) return;
    setErrorMsg(null);
    try {
      const res = await fetch('/api/fs/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentDir: browseData.currentPath, name: newDirName.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; path?: string; error?: string };
      if (!res.ok || !data.ok || !data.path) {
        setErrorMsg(data.error || 'Не удалось создать папку');
        return;
      }
      setNewDirName('');
      setFolderPath(data.path);
      await browseTo(data.path);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка создания папки');
    }
  };

  const handleNativePick = async () => {
    setNativePickerNote(null);
    try {
      const res = await fetch('/api/fs/pick-native', { method: 'POST' });
      const data = (await res.json()) as { supported?: boolean; path?: string; reason?: string };
      if (data.supported && data.path) {
        setFolderPath(data.path);
        void browseTo(data.path);
      } else {
        setNativePickerNote(
          data.reason || 'Системный GUI-диалог недоступен в этом окружении; выберите папку в проводнике ниже.',
        );
      }
    } catch (err) {
      setNativePickerNote(err instanceof Error ? err.message : 'Ошибка вызова системного диалога');
    }
  };

  const handleTestSsh = async () => {
    setSshTesting(true);
    setSshTestStatus(null);
    try {
      const res = await fetch('/api/ssh/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: sshHost.trim(),
          port: sshPort,
          user: sshUser.trim(),
          remotePath: sshRemotePath.trim(),
          authType: sshAuthType,
          identityFile: sshKeyPath.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; latencyMs?: number };
      setSshTestStatus({
        ok: Boolean(data.ok),
        msg: data.ok
          ? `SSH соединение и каталог подтверждены (${data.latencyMs ?? 0} мс)`
          : data.error || 'Ошибка SSH',
      });
    } catch (err) {
      setSshTestStatus({
        ok: false,
        msg: err instanceof Error ? err.message : 'Сетевая ошибка SSH',
      });
    } finally {
      setSshTesting(false);
    }
  };

  const handleVerifyGithub = async () => {
    setGhTesting(true);
    setGhTestStatus(null);
    try {
      const res = await fetch('/api/github/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: ghRepo.trim(), token: ghToken.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        repo?: { fullName: string; defaultBranch: string; isPrivate: boolean };
      };
      if (!res.ok || !data.ok || !data.repo) {
        setGhTestStatus({ ok: false, msg: data.error || `HTTP ${res.status}` });
      } else {
        setGhTestStatus({
          ok: true,
          msg: `Доступ подтверждён: ${data.repo.fullName} (${data.repo.isPrivate ? 'приватный' : 'публичный'}, ветка ${data.repo.defaultBranch})`,
        });
        if (!ghBranch.trim()) {
          setGhBranch(data.repo.defaultBranch);
        }
      }
    } catch (err) {
      setGhTestStatus({ ok: false, msg: err instanceof Error ? err.message : 'Ошибка GitHub API' });
    } finally {
      setGhTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Укажите название проекта.');
      return;
    }

    if (folderSource === 'local' && !folderPath.trim()) {
      setErrorMsg('Обязательно выберите или укажите локальную папку проекта.');
      return;
    }
    if (folderSource === 'ssh' && (!sshHost.trim() || !sshUser.trim() || !sshRemotePath.trim())) {
      setErrorMsg('Укажите SSH host, user и удалённый путь к папке проекта.');
      return;
    }
    if (folderSource === 'github' && !ghRepo.trim()) {
      setErrorMsg('Укажите GitHub репозиторий в формате owner/repo.');
      return;
    }

    const payload: SaveProjectPayload = {
      id: editingProject?.id,
      name: name.trim(),
      description: description.trim(),
      folderSource,
      folderPath: folderPath.trim(),
      allowedTools,
      defaultModelId,
    };

    if (folderSource === 'ssh') {
      payload.sshConfig = {
        host: sshHost.trim(),
        port: Number(sshPort) || 22,
        user: sshUser.trim(),
        remotePath: sshRemotePath.trim(),
        authType: sshAuthType,
        keyPath: sshKeyPath.trim() || undefined,
        password: sshPassword || undefined,
      };
    } else if (folderSource === 'github') {
      payload.githubConfig = {
        repo: ghRepo.trim(),
        branch: ghBranch.trim() || 'main',
        authMethod: ghAuthMethod,
        token: ghToken.trim() || undefined,
        localClonePath: ghLocalClonePath.trim() || undefined,
      };
    }

    setSaving(true);
    const result = await saveProject(payload);
    setSaving(false);

    if (!result.ok) {
      setErrorMsg(result.error || 'Не удалось сохранить проект.');
      return;
    }

    onClose();
  };

  const handleDelete = async () => {
    if (!editingProject) return;
    setSaving(true);
    await deleteProject(editingProject.id);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111115] shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {editingProject ? `Настройки проекта «${editingProject.name}»` : 'Новый рабочий проект'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Без подтверждённой папки (локальной, SSH или GitHub) проект не сохраняется.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Название проекта *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: My Python Service"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Модель по умолчанию
              </label>
              <select
                value={defaultModelId}
                onChange={(e) => setDefaultModelId(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
              >
                <option value="">Текущий активный провайдер</option>
                {localModels
                  .filter((m) => m.status === 'ready')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      GGUF: {m.name} ({m.quant})
                    </option>
                  ))}
                {freeProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    API: {p.name} ({p.selectedModel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Описание проекта
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кратко о задачах проекта и стеке..."
              className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Folder Source Switcher */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Источник папки проекта *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'local', label: 'Локальная папка', icon: FolderOpen },
                  { id: 'ssh', label: 'Удалённо по SSH', icon: Server },
                  { id: 'github', label: 'GitHub Clone', icon: GitBranch },
                ] as const
              ).map((src) => {
                const Icon = src.icon;
                const active = folderSource === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setFolderSource(src.id)}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                      active
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{src.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source 1: Local Directory Browser */}
          {folderSource === 'local' && (
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="/path/to/project или выберите ниже..."
                  className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    setBrowseOpen((v) => !v);
                    if (!browseData) void browseTo(folderPath || undefined);
                  }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-blue-500 whitespace-nowrap"
                >
                  {browseOpen ? 'Скрыть проводник' : 'Проводник ФС'}
                </button>
                <button
                  type="button"
                  onClick={handleNativePick}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-blue-500 whitespace-nowrap"
                >
                  Системный диалог
                </button>
              </div>

              {nativePickerNote && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400">
                  {nativePickerNote}
                </div>
              )}

              {browseOpen && browseData && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {browseData.roots.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => browseTo(r)}
                          className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-zinc-600 dark:text-zinc-300 hover:text-blue-500"
                        >
                          {r}
                        </button>
                      ))}
                      {browseData.parentPath && (
                        <button
                          type="button"
                          onClick={() => browseTo(browseData.parentPath!)}
                          className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-zinc-600 dark:text-zinc-300 hover:text-blue-500"
                        >
                          ..
                        </button>
                      )}
                      <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate">
                        {browseData.currentPath}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!browseData.writable || !browseData.readable}
                      onClick={() => setFolderPath(browseData.currentPath)}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium shrink-0"
                    >
                      Выбрать текущую
                    </button>
                  </div>

                  {!browseData.writable && (
                    <div className="text-[11px] text-rose-500">
                      Нет прав на запись в текущую директорию ({browseData.currentPath}). Выберите доступную папку или создайте подпапку в домашнем каталоге.
                    </div>
                  )}

                  <div className="max-h-36 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900">
                    {browseLoading ? (
                      <div className="py-3 text-center text-xs text-zinc-500">Чтение каталога...</div>
                    ) : browseData.entries.length === 0 ? (
                      <div className="py-2 text-xs text-zinc-500">Нет вложенных папок</div>
                    ) : (
                      browseData.entries.map((entry) => (
                        <div
                          key={entry.path}
                          className="flex items-center justify-between py-1.5 px-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded"
                        >
                          <button
                            type="button"
                            onClick={() => browseTo(entry.path)}
                            className="flex items-center gap-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 truncate text-left flex-1"
                          >
                            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="truncate">{entry.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFolderPath(entry.path)}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline px-2 shrink-0"
                          >
                            Выбрать
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-900">
                    <input
                      type="text"
                      value={newDirName}
                      onChange={(e) => setNewDirName(e.target.value)}
                      placeholder="Создать новую подпапку..."
                      className="flex-1 h-7 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={!newDirName.trim() || !browseData.writable}
                      onClick={handleCreateSubdir}
                      className="h-7 px-2.5 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-40 text-[11px] font-medium inline-flex items-center gap-1"
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>Создать</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source 2: SSH */}
          {folderSource === 'ssh' && (
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="Host / IP (e.g. 192.168.1.10)"
                  className="sm:col-span-2 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
                <input
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(Number(e.target.value) || 22)}
                  placeholder="22"
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="Пользователь (user)"
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
                <input
                  type="text"
                  value={sshRemotePath}
                  onChange={(e) => setSshRemotePath(e.target.value)}
                  placeholder="Удалённый путь (/home/dev/app)"
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={sshAuthType}
                  onChange={(e) => setSshAuthType(e.target.value as 'key' | 'agent' | 'password')}
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                >
                  <option value="key">SSH ключ</option>
                  <option value="agent">ssh-agent</option>
                  <option value="password">Пароль (в системный vault)</option>
                </select>
                {sshAuthType === 'key' ? (
                  <input
                    type="text"
                    value={sshKeyPath}
                    onChange={(e) => setSshKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_ed25519"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                  />
                ) : sshAuthType === 'password' ? (
                  <input
                    type="password"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    placeholder="SSH пароль (шифруется в vault)"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                  />
                ) : (
                  <div className="h-8 px-2.5 flex items-center text-[11px] text-zinc-500">
                    Используется SSH_AUTH_SOCK
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={sshTesting}
                  onClick={handleTestSsh}
                  className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium inline-flex items-center gap-1.5 hover:border-blue-500"
                >
                  {sshTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                  <span>Проверить SSH и права на папку</span>
                </button>
                {sshTestStatus && (
                  <span
                    className={cn(
                      'text-[11px] truncate max-w-[260px]',
                      sshTestStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
                    )}
                    title={sshTestStatus.msg}
                  >
                    {sshTestStatus.msg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Source 3: GitHub */}
          {folderSource === 'github' && (
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={ghRepo}
                  onChange={(e) => setGhRepo(e.target.value)}
                  placeholder="owner/repo"
                  className="sm:col-span-2 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
                <input
                  type="text"
                  value={ghBranch}
                  onChange={(e) => setGhBranch(e.target.value)}
                  placeholder="main"
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={ghAuthMethod}
                  onChange={(e) => setGhAuthMethod(e.target.value as 'public' | 'pat' | 'ssh')}
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                >
                  <option value="public">Публичный HTTPS</option>
                  <option value="pat">Personal Access Token (в vault)</option>
                  <option value="ssh">Git over SSH</option>
                </select>
                {ghAuthMethod === 'pat' ? (
                  <input
                    type="password"
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    placeholder="ghp_... (сохраняется в vault)"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                  />
                ) : (
                  <input
                    type="text"
                    value={ghLocalClonePath}
                    onChange={(e) => setGhLocalClonePath(e.target.value)}
                    placeholder="Папка клона (опц., иначе ~/.kova-studio/repos)"
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={ghTesting || !ghRepo.trim()}
                  onClick={handleVerifyGithub}
                  className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium inline-flex items-center gap-1.5 hover:border-blue-500 disabled:opacity-45"
                >
                  {ghTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>Проверить доступ GitHub API</span>
                </button>
                {ghTestStatus && (
                  <span
                    className={cn(
                      'text-[11px] truncate max-w-[280px]',
                      ghTestStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
                    )}
                    title={ghTestStatus.msg}
                  >
                    {ghTestStatus.msg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Allowed Tools */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Разрешённые инструменты агента
            </label>
            <div className="flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((t) => {
                const checked = allowedTools.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors',
                      checked
                        ? 'border-blue-500/60 bg-blue-500/10 text-zinc-900 dark:text-zinc-100'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTool(t.id)}
                      className="accent-blue-600"
                    />
                    <span>{t.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            {editingProject ? (
              confirmDelete ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-rose-500 font-medium">
                    Удалить из списка? (Файлы на диске останутся)
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium"
                  >
                    Подтвердить
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-500"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="h-9 px-3 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить проект</span>
                </button>
              )
            ) : (
              <span className="text-[11px] text-zinc-500">
                Сохраняется в ~/.kova-studio/projects.json
              </span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Проверка и сохранение...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{editingProject ? 'Сохранить изменения' : 'Создать проект'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
