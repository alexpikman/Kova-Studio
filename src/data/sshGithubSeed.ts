import type {
  GitHubAccessSettings,
  SshGlobalSettings,
  SshHostEntry,
  SshKeyProfile,
} from '../types/kova';

export const INITIAL_SSH_KEYS: SshKeyProfile[] = [
  {
    id: 'ssh-key-kova-ed25519',
    name: 'ONE CORE AI Primary (GitHub & Deploy)',
    algorithm: 'ed25519',
    comment: 'kova-studio@windows-workstation',
    privateKeyPath: '%USERPROFILE%\\.ssh\\id_ed25519_kova',
    publicKey:
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKv9xQ7pM2nR8vL4tY6wZ1cB5hN3jD9fG2mK8qP4sX7a kova-studio@windows-workstation',
    fingerprint: 'SHA256:9xK2mP7vL4qR8nT3wZ1cB5hN6jD0fG2mK8qP4sX7aV2',
    hasPassphrase: true,
    addedToAgent: true,
    createdAt: '2026-02-14',
  },
  {
    id: 'ssh-key-build-node',
    name: 'Remote Build Server Key',
    algorithm: 'rsa-4096',
    comment: 'ci-runner@win-local',
    privateKeyPath: '%USERPROFILE%\\.ssh\\id_rsa_build',
    publicKey:
      'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCy7nM3kP9vR2xL8qT5wZ1cB4hN6jD2fG9mK3qP7sX4aW8n ci-runner@win-local',
    fingerprint: 'SHA256:4bT8nM2kP9vR3xL7qW5zC1bH6jD2fG9mK3qP7sX4aY1',
    hasPassphrase: false,
    addedToAgent: false,
    createdAt: '2026-01-28',
  },
];

export const INITIAL_SSH_HOSTS: SshHostEntry[] = [
  {
    id: 'host-github',
    alias: 'github.com',
    hostName: 'github.com',
    user: 'git',
    port: 22,
    identityFile: '%USERPROFILE%\\.ssh\\id_ed25519_kova',
    forwardAgent: false,
    strictHostKeyChecking: 'accept-new',
    status: 'untested',
  },
  {
    id: 'host-staging',
    alias: 'win-gpu-node',
    hostName: '192.168.1.48',
    user: 'developer',
    port: 22,
    identityFile: '%USERPROFILE%\\.ssh\\id_rsa_build',
    forwardAgent: true,
    strictHostKeyChecking: 'accept-new',
    status: 'untested',
  },
];

export const INITIAL_SSH_SETTINGS: SshGlobalSettings = {
  openSshAgentAutoStart: true,
  windowsOpenSshPath: 'C:\\Windows\\System32\\OpenSSH\\ssh.exe',
  defaultKeyDir: '%USERPROFILE%\\.ssh\\',
  useGitSshCommandEnv: true,
};

export const INITIAL_GITHUB_SETTINGS: GitHubAccessSettings = {
  authMethod: 'ssh',
  repoOwnerSlashName: 'alexpikman/Kova-Studio',
  defaultBranch: 'main',
  gitUserName: 'Kova Developer',
  gitUserEmail: 'dev@kova-studio.local',
  tokenInput: '',
  scopes: {
    repo: true,
    workflow: true,
    writePackages: false,
    readUser: true,
  },
  autoSignCommits: true,
  lastVerifyStatus: 'idle',
  lastVerifyMessage: '',
};

export function buildSshConfigText(hosts: SshHostEntry[]): string {
  return hosts
    .map((h) => {
      const normalizedIdentity = h.identityFile.replace('%USERPROFILE%', '~').replace(/\\/g, '/');
      return [
        `Host ${h.alias}`,
        `    HostName ${h.hostName}`,
        `    User ${h.user}`,
        `    Port ${h.port}`,
        `    IdentityFile ${normalizedIdentity}`,
        `    IdentitiesOnly yes`,
        `    ForwardAgent ${h.forwardAgent ? 'yes' : 'no'}`,
        `    StrictHostKeyChecking ${h.strictHostKeyChecking}`,
      ].join('\n');
    })
    .join('\n\n');
}

export function buildWindowsSshGithubScript(
  sshSettings: SshGlobalSettings,
  activeKey: SshKeyProfile | undefined,
  hosts: SshHostEntry[],
  github: GitHubAccessSettings,
): string {
  const keyPath = (activeKey?.privateKeyPath ?? '%USERPROFILE%\\.ssh\\id_ed25519_kova').replace(
    '%USERPROFILE%',
    '$env:USERPROFILE',
  );
  const algoFlag = activeKey?.algorithm === 'rsa-4096' ? 'rsa -b 4096' : activeKey?.algorithm === 'ecdsa' ? 'ecdsa -b 521' : 'ed25519';
  const sshConfigContent = buildSshConfigText(hosts);
  const remoteUrl =
    github.authMethod === 'ssh'
      ? `git@github.com:${github.repoOwnerSlashName}.git`
      : `https://github.com/${github.repoOwnerSlashName}.git`;

  return `# ONE CORE AI — Настройка SSH и GitHub на Windows 10/11
$ErrorActionPreference = "Stop"

# 1. Каталог ~/.ssh и генерация ключа (если отсутствует)
$SshDir = "$env:USERPROFILE\\.ssh"
$KeyPath = "${keyPath}"
New-Item -ItemType Directory -Force -Path $SshDir | Out-Null

if (-not (Test-Path $KeyPath)) {
    ssh-keygen -t ${algoFlag} -C "${activeKey?.comment ?? github.gitUserEmail}" -f $KeyPath${activeKey?.hasPassphrase ? '' : ' -N ""'}
}

${
  sshSettings.openSshAgentAutoStart
    ? `# 2. Автозапуск службы Windows OpenSSH Authentication Agent и добавление ключа
Set-Service -Name ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add $KeyPath`
    : `# 2. Добавление ключа вручную (ssh-agent автозапуск отключён)
ssh-add $KeyPath`
}

# 3. Запись ~/.ssh/config
@"
${sshConfigContent}
"@ | Set-Content -Path "$SshDir\\config" -Encoding UTF8

# 4. Глобальная конфигурация Git и GitHub
git config --global user.name "${github.gitUserName}"
git config --global user.email "${github.gitUserEmail}"
${
  sshSettings.useGitSshCommandEnv
    ? `git config --global core.sshCommand "${sshSettings.windowsOpenSshPath.replace(/\\/g, '/')}"`
    : '# core.sshCommand не переопределяется'
}
${
  github.autoSignCommits
    ? `git config --global gpg.format ssh
git config --global user.signingkey "$KeyPath.pub"
git config --global commit.gpgsign true`
    : '# Подпись коммитов отключена'
}

${
  github.authMethod === 'pat'
    ? `# 5. Сохранение GitHub PAT в Windows Credential Manager (без открытого текста в скрипте)
git config --global credential.helper manager
Write-Host "При первом git push введите ваш GitHub PAT в окне Git Credential Manager." -ForegroundColor Yellow`
    : github.authMethod === 'gh-cli'
      ? `# 5. Авторизация через GitHub CLI
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    winget install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements
}
gh auth login -p https -w`
      : `# 5. Проверка SSH-соединения с GitHub
ssh -T git@github.com`
}

Write-Host "Репозиторий: ${remoteUrl} (ветка ${github.defaultBranch})" -ForegroundColor Green`;
}
