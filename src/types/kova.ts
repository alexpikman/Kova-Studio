export type AppTab = 'workstation' | 'models' | 'roles' | 'ssh-github' | 'install' | 'architecture';
export type AgentMode = 'plan' | 'act';
export type GpuBackend = 'auto' | 'cuda' | 'vulkan' | 'cpu';
export type ServerStatus = 'ready' | 'generating' | 'loading' | 'stopped' | 'error';

export type RolePersonaKind = 'architect' | 'developer' | 'reviewer' | 'qa' | 'custom';
export type PermissionPolicy = 'allow' | 'ask' | 'deny';

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
  status: 'idle' | 'running' | 'done';
  resultNote?: string;
}

export interface ProjectFile {
  path: string;
  name: string;
  folder: string;
  language: 'rust' | 'typescript' | 'toml' | 'json';
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
  shell: 'powershell' | 'cmd';
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
  timestamp: string;
  content: string;
  readFiles?: string[];
  diff?: DiffProposal;
  command?: CommandProposal;
  checkpointId?: string;
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
  sizeGb: number;
  minVramGb: number;
  minRamGb: number;
  license: string;
  sha256: string;
  localPath: string;
  status: 'ready' | 'downloading' | 'paused' | 'verifying';
  progressPct: number;
  speedMbps: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface InferenceSettings {
  gpuBackend: GpuBackend;
  detectedGpuName: string;
  detectedBackend: 'CUDA 12.4' | 'Vulkan 1.3' | 'CPU AVX2';
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
