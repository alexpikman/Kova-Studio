import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  Github,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
  XCircle,
} from 'lucide-react';
import { buildSshConfigText, buildWindowsSshGithubScript } from '../../data/sshGithubSeed';
import { useKovaStore } from '../../store/useKovaStore';
import type { GitHubAuthMethod, SshAlgorithm } from '../../types/kova';
import { cn } from '../../utils/cn';

type CodeTab = 'ssh-config' | 'ps1-setup';

export const SshGithubView: React.FC = () => {
  const {
    sshKeys,
    activeSshKeyId,
    sshHosts,
    sshSettings,
    githubAccess,
    setActiveSshKey,
    addSshKey,
    toggleSshKeyInAgent,
    deleteSshKey,
    addSshHost,
    deleteSshHost,
    testSshHostConnection,
    updateSshSettings,
    updateGitHubAccess,
    verifyGitHubAccess,
  } = useKovaStore();

  const activeKey = sshKeys.find((k) => k.id === activeSshKeyId) ?? sshKeys[0];

  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyAlgo, setNewKeyAlgo] = useState<SshAlgorithm>('ed25519');
  const [newKeyComment, setNewKeyComment] = useState(githubAccess.gitUserEmail);
  const [newKeyPassphrase, setNewKeyPassphrase] = useState(true);

  const [showNewHostForm, setShowNewHostForm] = useState(false);
  const [hostAlias, setHostAlias] = useState('');
  const [hostName, setHostName] = useState('');
  const [hostUser, setHostUser] = useState('ubuntu');
  const [hostPort, setHostPort] = useState(22);
  const [hostForwardAgent, setHostForwardAgent] = useState(false);

  const [showToken, setShowToken] = useState(false);
  const [codeTab, setCodeTab] = useState<CodeTab>('ssh-config');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sshConfigText = useMemo(() => buildSshConfigText(sshHosts), [sshHosts]);
  const setupPs1Text = useMemo(
    () => buildWindowsSshGithubScript(sshSettings, activeKey, sshHosts, githubAccess),
    [sshSettings, activeKey, sshHosts, githubAccess],
  );

  const copyValue = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    addSshKey({
      name: newKeyName,
      algorithm: newKeyAlgo,
      comment: newKeyComment,
      hasPassphrase: newKeyPassphrase,
    });
    setNewKeyName('');
    setShowNewKeyForm(false);
  };

  const handleCreateHost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostAlias.trim() || !hostName.trim()) return;
    addSshHost({
      alias: hostAlias.trim(),
      hostName: hostName.trim(),
      user: hostUser.trim() || 'git',
      port: Number(hostPort) || 22,
      identityFile: activeKey?.privateKeyPath ?? '%USERPROFILE%\\.ssh\\id_ed25519_kova',
      forwardAgent: hostForwardAgent,
      strictHostKeyChecking: 'accept-new',
    });
    setHostAlias('');
    setHostName('');
    setShowNewHostForm(false);
  };

  const remoteGitUrl =
    githubAccess.authMethod === 'ssh'
      ? `git@github.com:${githubAccess.repoOwnerSlashName}.git`
      : `https://github.com/${githubAccess.repoOwnerSlashName}.git`;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="pb-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Настройки доступа по SSH и GitHub
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-3xl">
              Управление ключами Windows OpenSSH, профилями хостов <span className="font-mono">~/.ssh/config</span>, авторизацией на GitHub (SSH / PAT / <span className="font-mono">gh</span> CLI) и проверкой прав доступа для репозитория и сборок.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => verifyGitHubAccess()}
              disabled={githubAccess.lastVerifyStatus === 'checking'}
              className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              {githubAccess.lastVerifyStatus === 'checking' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Проверить доступ GitHub</span>
            </button>
            <button
              type="button"
              onClick={() => downloadFile('setup-ssh-github.ps1', setupPs1Text)}
              className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span>Скачать setup-ssh-github.ps1</span>
            </button>
          </div>
        </div>

        {/* Main 2-column grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: SSH Keys + OpenSSH Settings + Host Config */}
          <div className="xl:col-span-6 space-y-5">
            {/* SSH Keys Card */}
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-500" />
                  <span>Ключи OpenSSH (Windows)</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewKeyForm((v) => !v)}
                  className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать SSH-ключ</span>
                </button>
              </div>

              {showNewKeyForm && (
                <form
                  onSubmit={handleCreateKey}
                  className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 space-y-3"
                >
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Генерация нового профиля ключа (ssh-keygen)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                        Название профиля
                      </label>
                      <input
                        type="text"
                        required
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Workstation Ed25519"
                        className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                        Алгоритм
                      </label>
                      <select
                        value={newKeyAlgo}
                        onChange={(e) => setNewKeyAlgo(e.target.value as SshAlgorithm)}
                        className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="ed25519">Ed25519 (рекомендуется)</option>
                        <option value="rsa-4096">RSA 4096-bit</option>
                        <option value="ecdsa">ECDSA P-521</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                        Комментарий (-C)
                      </label>
                      <input
                        type="text"
                        value={newKeyComment}
                        onChange={(e) => setNewKeyComment(e.target.value)}
                        placeholder="dev@kova-studio.local"
                        className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <label className="h-8 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyPassphrase}
                        onChange={(e) => setNewKeyPassphrase(e.target.checked)}
                        className="accent-blue-600"
                      />
                      <span>Защитить ключ кодовой фразой</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewKeyForm(false)}
                      className="h-8 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                    >
                      Создать профиль ключа
                    </button>
                  </div>
                </form>
              )}

              {/* Keys List */}
              <div className="space-y-3">
                {sshKeys.map((key) => {
                  const isActive = key.id === activeKey?.id;
                  return (
                    <div
                      key={key.id}
                      onClick={() => setActiveSshKey(key.id)}
                      className={cn(
                        'p-3.5 rounded-lg border transition-colors cursor-pointer space-y-2.5',
                        isActive
                          ? 'border-blue-500/60 bg-blue-500/[0.04]'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:border-zinc-300 dark:hover:border-zinc-700',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {key.name}
                            </span>
                            {isActive && (
                              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                · Активен
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                            {key.privateKeyPath} · {key.algorithm.toUpperCase()} · {key.createdAt}
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSshKeyInAgent(key.id)}
                            className={cn(
                              'h-7 px-2 rounded border text-[11px] font-medium transition-colors',
                              key.addedToAgent
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200',
                            )}
                            title="Состояние в службе Windows ssh-agent"
                          >
                            {key.addedToAgent ? 'В ssh-agent' : 'Добавить в агент'}
                          </button>
                          {sshKeys.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteSshKey(key.id)}
                              className="h-7 w-7 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-rose-500/10 hover:text-rose-500 text-zinc-400 inline-flex items-center justify-center"
                              title="Удалить профиль ключа"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className="p-2 rounded bg-zinc-950 text-zinc-300 font-mono text-[11px] flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate select-all">{key.publicKey}</span>
                        <button
                          type="button"
                          onClick={() => copyValue(`pub-${key.id}`, key.publicKey)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] inline-flex items-center gap-1 shrink-0"
                        >
                          {copiedId === `pub-${key.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>.pub</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        <span className="truncate">{key.fingerprint}</span>
                        <span>{key.hasPassphrase ? 'Passphrase: да' : 'Без passphrase'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Global OpenSSH Windows settings */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Параметры Windows OpenSSH Client
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                      Бинарник ssh.exe
                    </label>
                    <input
                      type="text"
                      value={sshSettings.windowsOpenSshPath}
                      onChange={(e) => updateSshSettings({ windowsOpenSshPath: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                      Каталог ключей
                    </label>
                    <input
                      type="text"
                      value={sshSettings.defaultKeyDir}
                      onChange={(e) => updateSshSettings({ defaultKeyDir: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1 text-xs text-zinc-700 dark:text-zinc-300">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sshSettings.openSshAgentAutoStart}
                      onChange={(e) =>
                        updateSshSettings({ openSshAgentAutoStart: e.target.checked })
                      }
                      className="accent-blue-600"
                    />
                    <span>Автозапуск службы ssh-agent</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sshSettings.useGitSshCommandEnv}
                      onChange={(e) =>
                        updateSshSettings({ useGitSshCommandEnv: e.target.checked })
                      }
                      className="accent-blue-600"
                    />
                    <span>Передавать core.sshCommand в Git</span>
                  </label>
                </div>
              </div>
            </section>

            {/* SSH Hosts (~/.ssh/config) */}
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-500" />
                  <span>Хосты SSH (~/.ssh/config)</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewHostForm((v) => !v)}
                  className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить хост</span>
                </button>
              </div>

              {showNewHostForm && (
                <form
                  onSubmit={handleCreateHost}
                  className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Alias (Host)</label>
                      <input
                        type="text"
                        required
                        value={hostAlias}
                        onChange={(e) => setHostAlias(e.target.value)}
                        placeholder="prod-server"
                        className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">
                        HostName / IP
                      </label>
                      <input
                        type="text"
                        required
                        value={hostName}
                        onChange={(e) => setHostName(e.target.value)}
                        placeholder="192.168.1.90"
                        className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">User</label>
                      <input
                        type="text"
                        value={hostUser}
                        onChange={(e) => setHostUser(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-500 mb-1">Port</label>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={hostPort}
                        onChange={(e) => setHostPort(Number(e.target.value) || 22)}
                        className="w-full h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 tabular-nums"
                      />
                    </div>
                    <label className="h-8 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hostForwardAgent}
                        onChange={(e) => setHostForwardAgent(e.target.checked)}
                        className="accent-blue-600"
                      />
                      <span>ForwardAgent</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewHostForm(false)}
                      className="h-8 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                    >
                      Добавить в ~/.ssh/config
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2.5">
                {sshHosts.map((host) => (
                  <div
                    key={host.id}
                    className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {host.alias}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {host.user}@{host.hostName}:{host.port}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                        Ключ: {host.identityFile} · StrictHostKeyChecking: {host.strictHostKeyChecking}
                      </div>
                      {host.lastChecked && (
                        <div
                          className={cn(
                            'text-[11px] flex items-center gap-1 pt-0.5',
                            host.status === 'connected'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500',
                          )}
                        >
                          {host.status === 'connected' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>{host.lastChecked}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => testSshHostConnection(host.id)}
                        className="h-8 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1"
                      >
                        <Terminal className="w-3 h-3 text-blue-500" />
                        <span>Тест SSH</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSshHost(host.id)}
                        className="h-8 w-8 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-rose-500/10 hover:text-rose-500 text-zinc-400 inline-flex items-center justify-center"
                        title="Удалить хост"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: GitHub Access + Generated Config & PowerShell */}
          <div className="xl:col-span-6 space-y-5">
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Github className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                  <span>Доступ к GitHub и настройки Git</span>
                </h2>
                <div className="flex items-center gap-2 text-[11px]">
                  <a
                    href="https://github.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>SSH-ключи GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-zinc-400">·</span>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,workflow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Создать PAT</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Auth Method Selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Метод аутентификации GitHub
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'ssh', label: 'SSH-ключ', desc: 'git@github.com' },
                      { id: 'pat', label: 'Токен (PAT)', desc: 'HTTPS + GCM' },
                      { id: 'gh-cli', label: 'GitHub CLI', desc: 'gh auth login' },
                    ] as { id: GitHubAuthMethod; label: string; desc: string }[]
                  ).map((method) => {
                    const selected = githubAccess.authMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => updateGitHubAccess({ authMethod: method.id })}
                        className={cn(
                          'p-2.5 rounded-lg border text-left transition-colors',
                          selected
                            ? 'border-blue-500 bg-blue-500/10 text-zinc-950 dark:text-zinc-50'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700',
                        )}
                      >
                        <div className="text-xs font-semibold">{method.label}</div>
                        <div className="font-mono text-[10px] opacity-80 mt-0.5">{method.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Repo & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Целевой репозиторий (owner/repo)
                  </label>
                  <input
                    type="text"
                    value={githubAccess.repoOwnerSlashName}
                    onChange={(e) => updateGitHubAccess({ repoOwnerSlashName: e.target.value })}
                    placeholder="owner/repo"
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Ветка
                  </label>
                  <div className="relative">
                    <GitBranch className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={githubAccess.defaultBranch}
                      onChange={(e) => updateGitHubAccess({ defaultBranch: e.target.value })}
                      className="w-full h-9 pl-8 pr-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Remote URL read-only bar */}
              <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[11px] text-zinc-500 mr-2">origin:</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
                    {remoteGitUrl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyValue('remote-url', remoteGitUrl)}
                  className="h-7 px-2 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 inline-flex items-center gap-1 shrink-0"
                >
                  {copiedId === 'remote-url' ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Копировать</span>
                </button>
              </div>

              {/* Git author */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Git user.name
                  </label>
                  <input
                    type="text"
                    value={githubAccess.gitUserName}
                    onChange={(e) => updateGitHubAccess({ gitUserName: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Git user.email
                  </label>
                  <input
                    type="email"
                    value={githubAccess.gitUserEmail}
                    onChange={(e) => updateGitHubAccess({ gitUserEmail: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* PAT Token & Scopes */}
              {githubAccess.authMethod === 'pat' && (
                <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/70 space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      GitHub Personal Access Token (для live-проверки API; в Windows хранится в Credential Manager)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={githubAccess.tokenInput}
                        onChange={(e) => updateGitHubAccess({ tokenInput: e.target.value })}
                        placeholder="ghp_... или github_pat_..."
                        className="w-full h-9 pl-3 pr-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((v) => !v)}
                        className="absolute right-2 p-1 text-zinc-400 hover:text-zinc-200"
                        aria-label="Показать или скрыть токен"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Необходимые права (scopes) для релизов Tauri (.exe / .msi):
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(
                        [
                          { key: 'repo', label: 'repo (код и релизы)' },
                          { key: 'workflow', label: 'workflow (GitHub Actions)' },
                          { key: 'writePackages', label: 'write:packages' },
                          { key: 'readUser', label: 'read:user (профиль)' },
                        ] as const
                      ).map((sc) => (
                        <label
                          key={sc.key}
                          className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={githubAccess.scopes[sc.key]}
                            onChange={(e) =>
                              updateGitHubAccess({
                                scopes: {
                                  ...githubAccess.scopes,
                                  [sc.key]: e.target.checked,
                                },
                              })
                            }
                            className="accent-blue-600"
                          />
                          <span className="font-mono text-[11px]">{sc.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={githubAccess.autoSignCommits}
                  onChange={(e) => updateGitHubAccess({ autoSignCommits: e.target.checked })}
                  className="accent-blue-600"
                />
                <span>
                  Подписывать Git-коммиты активным SSH-ключом (<span className="font-mono">gpg.format = ssh</span>)
                </span>
              </label>

              {/* Verification Status Box */}
              {githubAccess.lastVerifyStatus !== 'idle' && (
                <div
                  className={cn(
                    'p-3 rounded-lg border text-xs flex items-start gap-2.5',
                    githubAccess.lastVerifyStatus === 'ok'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                      : githubAccess.lastVerifyStatus === 'error'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                        : 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200',
                  )}
                >
                  {githubAccess.lastVerifyStatus === 'ok' ? (
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                  ) : githubAccess.lastVerifyStatus === 'error' ? (
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  ) : (
                    <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin text-blue-500" />
                  )}
                  <span className="leading-relaxed">{githubAccess.lastVerifyMessage}</span>
                </div>
              )}
            </section>

            {/* Generated Config & PowerShell Setup Script */}
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-200 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCodeTab('ssh-config')}
                    className={cn(
                      'px-2.5 py-1 rounded font-mono text-[11px] transition-colors',
                      codeTab === 'ssh-config'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200',
                    )}
                  >
                    ~/.ssh/config
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeTab('ps1-setup')}
                    className={cn(
                      'px-2.5 py-1 rounded font-mono text-[11px] transition-colors',
                      codeTab === 'ps1-setup'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200',
                    )}
                  >
                    setup-ssh-github.ps1
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      copyValue(
                        `code-${codeTab}`,
                        codeTab === 'ssh-config' ? sshConfigText : setupPs1Text,
                      )
                    }
                    className="px-2 py-1 rounded hover:bg-zinc-800 text-zinc-300 text-[11px] inline-flex items-center gap-1"
                  >
                    {copiedId === `code-${codeTab}` ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === `code-${codeTab}` ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        codeTab === 'ssh-config' ? 'config' : 'setup-ssh-github.ps1',
                        codeTab === 'ssh-config' ? sshConfigText : setupPs1Text,
                      )
                    }
                    className="px-2 py-1 rounded hover:bg-zinc-800 text-zinc-300 text-[11px] inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Скачать</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 font-mono text-[11.5px] leading-5 overflow-x-auto max-h-80 overflow-y-auto">
                {codeTab === 'ssh-config' ? sshConfigText : setupPs1Text}
              </pre>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
