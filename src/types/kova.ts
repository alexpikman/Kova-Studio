export type AppTab = 'workstation' | 'models' | 'roles' | 'architecture' | 'settings';
export type UiStylePreset = 'cline-vscode' | 'mica-windows' | 'cyber-terminal';
export type SettingsSectionId =
  | 'ui-chat'
  | 'providers'
  | 'skills-memory'
  | 'execution-env'
  | 'gateway'
  | 'engine-paths'
  | 'ssh-github'
  | 'github-download';
export type AgentMode = 'plan' | 'act';
export type GpuBackend = 'auto' | 'cuda' | 'vulkan' | 'cpu';
export type ServerStatus = 'ready' | 'generating' | 'loading' | 'stopped' | 'error';

export type RolePersonaKind = 'architect' | 'developer' | 'reviewer' | 'qa' | 'custom';
export type PermissionPolicy = 'allow' | 'ask' | 'deny';

export interface HardwareGpuInfo {
  vendor: 'nvidia' | 'amd' | 'apple' | 'intel' | 'unknown';
  name: string;
  vramTotalGb: number;
  vramFreeGb: number;
  driverOrRuntime: string;
}

export interface HardwareProfile {
  detectedAt: string;
  os: {
    platform: string;
    release: string;
    arch: string;
    hostname: string;
  };
  cpu: {
    model: string;
    cores: number;
  };
  ram: {
    totalBytes: number;
    freeBytes: number;
    totalGb: number;
    freeGb: number;
  };
  disk: {
    path: string;
    totalBytes: number;
    freeBytes: number;
    totalGb: number;
    freeGb: number;
  };
  gpuDetected: boolean;
  gpus: HardwareGpuInfo[];
  totalVramGb: number;
  freeVramGb: number;
  recommendedBackend: 'cuda' | 'rocm' | 'metal' | 'cpu';
  backendVersion: string;
  notes: string[];
}

export type ModelFitCategory = 'fits-vram' | 'fits-ram' | 'too-heavy';

export interface ModelRecommendation {
  id: string;
  category: ModelFitCategory;
  categoryLabel: 'Поместится в VRAM' | 'Поместится в RAM (CPU)' | 'Слишком тяжело';
  requiredVramGb: number;
  requiredRamGb: number;
  remainingVramAfterGb: number;
  remainingRamAfterGb: number;
  diskFits: boolean;
  reason: string;
  warning?: string;
  allowManualOverride: boolean;
}

export type ProjectFolderSource = 'local' | 'ssh' | 'github';

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  folderSource: ProjectFolderSource;
  folderPath: string;
  allowedTools: string[];
  defaultModelId: string;
  sshConfig?: {
    host: string;
    port: number;
    user: string;
    remotePath: string;
    authType: 'key' | 'agent' | 'password';
    keyPath?: string;
  };
  githubConfig?: {
    repo: string;
    branch: string;
    authMethod: 'public' | 'pat' | 'ssh';
  };
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectActionLogEntry {
  id: string;
  projectId: string;
  timestamp: string;
  kind: 'file_write' | 'command' | 'git' | 'undo' | 'task';
  summary: string;
  filePath?: string;
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  undone?: boolean;
}

export interface FsDirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FsBrowseResult {
  currentPath: string;
  parentPath: string | null;
  exists: boolean;
  isDirectory: boolean;
  readable: boolean;
  writable: boolean;
  entries: FsDirectoryEntry[];
  roots: string[];
  error?: string;
}

export interface ChatVisibilitySettings {
  showLeftSidebar: boolean;
  showProjectTree: boolean;
  showLocalModels: boolean;
  showSessionHistory: boolean;
  showSkillsMemoryTab: boolean;
  showRightInspector: boolean;
  showMascot: boolean;
  showTelemetry: boolean;
  showFreeProviderCard: boolean;
  showInferenceControls: boolean;
  showSubagentsPanel: boolean;
  showActiveContext: boolean;
  showToolbar: boolean;
  showExecutionEnvBar: boolean;
  showTaskBanner: boolean;
  showMessageHeaders: boolean;
  showTimestamps: boolean;
  showReadFilesChips: boolean;
  showDiffBlocks: boolean;
  showTerminalBlocks: boolean;
  showCheckpointBadges: boolean;
  showRoleSwitcher: boolean;
  showQuickPrompts: boolean;
  showComposerStatusRow: boolean;
}

export type FreeProviderKind =
  | 'llama-cpp'
  | 'ollama'
  | 'lmstudio'
  | 'openrouter-free'
  | 'groq-free'
  | 'custom';

export interface FreeProviderProfile {
  id: string;
  kind: FreeProviderKind;
  name: string;
  badgeText: string;
  baseUrl: string;
  apiKey: string;
  requiresKey: boolean;
  isLocal: boolean;
  selectedModel: string;
  availableModels: string[];
  description: string;
  status: 'idle' | 'checking' | 'connected' | 'error';
  lastCheckMessage?: string;
}

export interface AgentSkill {
  id: string;
  slug: string;
  title: string;
  category: 'Разработка' | 'DevOps' | 'Исследование' | 'Автоматизация';
  triggerHint: string;
  contentMarkdown: string;
  enabled: boolean;
  usageCount: number;
  source: 'builtin' | 'learned' | 'custom';
  updatedAt: string;
}

export type AgentMemoryKey = 'soul' | 'memory' | 'user';

export interface AgentMemoryDoc {
  key: AgentMemoryKey;
  filename: 'SOUL.md' | 'MEMORY.md' | 'USER.md';
  title: string;
  description: string;
  content: string;
  updatedAt: string;
}

export type SubagentStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface SubagentRun {
  id: string;
  title: string;
  prompt: string;
  roleId: string;
  roleName: string;
  providerId: string;
  providerName: string;
  modelName: string;
  status: SubagentStatus;
  progressPct: number;
  resultSummary: string;
  startedAt: string;
}

export interface SubagentConfig {
  enabled: boolean;
  maxParallel: number;
  maxIterations: number;
  defaultRoleId: string;
  defaultProviderId: string;
  autoSummarizeResult: boolean;
}

export type ExecutionEnvKind = 'local' | 'ssh' | 'docker';

export interface ExecutionEnvConfig {
  activeEnv: ExecutionEnvKind;
  localShell: 'powershell' | 'cmd' | 'sh';
  localWorkdir: string;
  sshHostId: string;
  dockerImage: string;
  dockerWorkdir: string;
  dockerMountWorkspace: boolean;
  dockerNetworkMode: 'bridge' | 'none';
  requireApprovalBeforeExec: boolean;
}

export type GatewayPlatform = 'telegram' | 'discord' | 'slack';

export interface GatewayChannelConfig {
  id: GatewayPlatform;
  name: string;
  enabled: boolean;
  botToken: string;
  allowedChatIds: string;
  prefixCommand: string;
  autoReplyVoiceNotes: boolean;
  requireApprovalForWrite: boolean;
  status: 'idle' | 'checking' | 'connected' | 'error';
  statusMessage: string;
}

export type SshAlgorithm = 'ed25519' | 'rsa-4096' | 'ecdsa';
export type GitHubAuthMethod = 'ssh' | 'pat' | 'gh-cli';

export interface SshKeyProfile {
  id: string;
  name: string;
  algorithm: SshAlgorithm;
  comment: string;
  privateKeyPath: string;
  publicKey: string;
  fingerprint: string;
  hasPassphrase: boolean;
  addedToAgent: boolean;
  createdAt: string;
}

export interface SshHostEntry {
  id: string;
  alias: string;
  hostName: string;
  user: string;
  port: number;
  identityFile: string;
  forwardAgent: boolean;
  strictHostKeyChecking: 'yes' | 'accept-new' | 'no';
  status: 'untested' | 'connected' | 'error';
  lastChecked?: string;
}

export interface SshGlobalSettings {
  openSshAgentAutoStart: boolean;
  windowsOpenSshPath: string;
  defaultKeyDir: string;
  useGitSshCommandEnv: boolean;
}

export interface GitHubAccessSettings {
  authMethod: GitHubAuthMethod;
  repoOwnerSlashName: string;
  defaultBranch: string;
  gitUserName: string;
  gitUserEmail: string;
  tokenInput: string;
  scopes: {
    repo: boolean;
    workflow: boolean;
    writePackages: boolean;
    readUser: boolean;
  };
  autoSignCommits: boolean;
  lastVerifyStatus: 'idle' | 'checking' | 'ok' | 'error';
  lastVerifyMessage: string;
}

export interface ModelRole {
  id: string;
  name: string;
  persona: RolePersonaKind;
  tagline: string;
  systemPrompt: string;
  defaultMode: AgentMode;
  recommendedTemp: number;
  accentHex: string;
  isCustom?: boolean;
}

export interface PermissionRule {
  id: string;
  category: 'Файловая система' | 'Терминал' | 'Сеть и модели' | 'Безопасность';
  title: string;
  description: string;
  policy: PermissionPolicy;
}

export interface ModelDirective {
  id: string;
  category: 'Архитектура' | 'Качество кода' | 'Безопасность' | 'Стиль ответа';
  title: string;
  instruction: string;
  enabled: boolean;
  isCustom?: boolean;
}

export interface PipelineStage {
  id: string;
  stepNumber: number;
  title: string;
  shortGoal: string;
  assignedRoleId: string;
  mode: AgentMode;
  outputArtifact: string;
  status: 'idle' | 'running' | 'done' | 'error';
  resultNote?: string;
}

export interface ProjectFile {
  path: string;
  name: string;
  folder: string;
  language: string;
  sizeBytes?: number;
  content: string;
  originalContent: string;
  inContext: boolean;
  tokensEstimate: number;
}

export interface Checkpoint {
  id: string;
  label: string;
  timestamp: string;
  actionSummary: string;
  filesSnapshot: Record<string, string>;
}

export interface DiffProposal {
  id: string;
  filePath: string;
  summary: string;
  oldContent: string;
  newContent: string;
  status: 'pending' | 'applied' | 'rejected';
  checkpointId?: string;
}

export interface CommandProposal {
  id: string;
  shell: 'powershell' | 'cmd' | 'sh';
  command: string;
  cwd: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output: string[];
  exitCode?: number;
  canDiagnose?: boolean;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: AgentMode;
  roleId?: string;
  roleName?: string;
  providerLabel?: string;
  timestamp: string;
  content: string;
  readFiles?: string[];
  diff?: DiffProposal;
  command?: CommandProposal;
  checkpointId?: string;
  subagentRun?: SubagentRun;
  skillLearned?: boolean;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  mode: AgentMode;
  messages: AgentMessage[];
}

export interface GgufFileVariant {
  filename: string;
  quant: string;
  sizeBytes: number;
  sizeGb: number;
  sha256: string | null;
  downloadUrl: string;
}

export interface ModelCatalogItem {
  id: string;
  repoId: string;
  name: string;
  author: string;
  description?: string;
  downloads: number;
  likes: number;
  license: string;
  lastModified: string;
  tags: string[];
  quantizations: string[];
  defaultQuant: string;
  sizeGb: number;
  minVramGb: number;
  minRamGb: number;
  sha256?: string;
  source: 'curated' | 'huggingface' | 'direct-url';
  url: string;
  files?: GgufFileVariant[];
}

export interface LocalModel {
  id: string;
  repoId: string;
  name: string;
  quant: string;
  filename: string;
  sourceType?: 'huggingface' | 'direct-url' | 'ollama' | 'local-import';
  downloadUrl?: string;
  sizeGb: number;
  minVramGb: number;
  minRamGb: number;
  license: string;
  sha256: string;
  expectedSha256?: string | null;
  computedSha256?: string | null;
  sha256Verified?: boolean;
  localPath: string;
  status: 'queued' | 'downloading' | 'paused' | 'verifying' | 'ready' | 'corrupt' | 'error';
  progressPct: number;
  speedBps?: number;
  speedMbps: number;
  etaSeconds?: number | null;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage?: string;
}

export interface InferenceSettings {
  gpuBackend: GpuBackend;
  detectedGpuName: string;
  detectedBackend: string;
  temperature: number;
  contextSize: number;
  gpuLayers: number;
  maxVramGb: number;
  maxRamGb: number;
}

export interface AppSettings {
  modelsDir: string;
  llamaServerPath: string;
  autoCheckSha256: boolean;
  includeOpenFilesByDefault: boolean;
  includeTreeByDefault: boolean;
  cloudFallbackProvider: 'none' | 'openai' | 'anthropic' | 'gemini';
  cloudFallbackKey: string;
}

export interface TrayNotification {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  read: boolean;
}
