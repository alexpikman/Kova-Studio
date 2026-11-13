import { create } from 'zustand';
import {
  INITIAL_DIRECTIVES,
  INITIAL_PERMISSIONS,
  INITIAL_PIPELINE_STAGES,
  INITIAL_ROLES,
} from '../data/rolesAndRules';
import { INITIAL_SESSIONS } from '../data/workspaceSeed';
import {
  INITIAL_GITHUB_SETTINGS,
  INITIAL_SSH_HOSTS,
  INITIAL_SSH_KEYS,
  INITIAL_SSH_SETTINGS,
} from '../data/sshGithubSeed';
import {
  INITIAL_EXECUTION_ENV,
  INITIAL_FREE_PROVIDERS,
  INITIAL_GATEWAYS,
  INITIAL_MEMORY_DOCS,
  INITIAL_SKILLS,
  INITIAL_SUBAGENT_CONFIG,
} from '../data/openKovaSeed';
import type {
  AgentMemoryDoc,
  AgentMemoryKey,
  AgentMode,
  AgentSkill,
  AppSettings,
  AppTab,
  ChatSession,
  ChatVisibilitySettings,
  Checkpoint,
  ExecutionEnvConfig,
  ExecutionEnvKind,
  FreeProviderProfile,
  GatewayChannelConfig,
  GatewayPlatform,
  GitHubAccessSettings,
  GpuBackend,
  HardwareProfile,
  InferenceSettings,
  LocalModel,
  ModelCatalogItem,
  ModelDirective,
  ModelRole,
  PermissionPolicy,
  PermissionRule,
  PipelineStage,
  ProjectActionLogEntry,
  ProjectFile,
  ProjectFolderSource,
  ProjectRecord,
  ServerStatus,
  SettingsSectionId,
  SshAlgorithm,
  SshGlobalSettings,
  SshHostEntry,
  SshKeyProfile,
  SubagentConfig,
  SubagentRun,
  TrayNotification,
  UiStylePreset,
} from '../types/kova';

interface DownloadQueuePayload {
  repoId: string;
  name: string;
  quant: string;
  filename: string;
  downloadUrl: string;
  sizeGb: number;
  totalBytes?: number;
  minVramGb: number;
  minRamGb: number;
  license: string;
  sha256?: string | null;
}

export interface SaveProjectPayload {
  id?: string;
  name: string;
  description?: string;
  folderSource: ProjectFolderSource;
  folderPath?: string;
  allowedTools?: string[];
  defaultModelId?: string;
  sshConfig?: {
    host: string;
    port?: number;
    user: string;
    remotePath: string;
    authType: 'key' | 'agent' | 'password';
    keyPath?: string;
    password?: string;
  };
  githubConfig?: {
    repo: string;
    branch?: string;
    authMethod?: 'public' | 'pat' | 'ssh';
    token?: string;
    localClonePath?: string;
  };
}

interface KovaStore {
  hydrated: boolean;
  activeTab: AppTab;
  theme: 'dark' | 'light';
  uiStyle: UiStylePreset;
  settingsSection: SettingsSectionId;
  chatVisibility: ChatVisibilitySettings;
  trayOpen: boolean;

  hardwareProfile: HardwareProfile | null;
  hardwareLoading: boolean;
  hardwareError: string | null;

  projects: ProjectRecord[];
  activeProjectId: string;
  projectLogs: ProjectActionLogEntry[];
  projectsLoading: boolean;

  sessions: ChatSession[];
  activeSessionId: string;
  agentMode: AgentMode;
  centerPaneMode: 'chat' | 'file';

  roles: ModelRole[];
  activeRoleId: string;
  permissions: PermissionRule[];
  directives: ModelDirective[];
  pipelineStages: PipelineStage[];
  pipelineProjectName: string;
  pipelineStack: string;
  pipelineRunning: boolean;

  files: ProjectFile[];
  selectedFilePath: string;
  includeProjectTree: boolean;
  includeTerminalOutput: boolean;
  terminalHistory: string[];

  checkpoints: Checkpoint[];

  localModels: LocalModel[];
  activeModelId: string;
  serverStatus: ServerStatus;
  tokensPerSec: number;
  vramUsedGb: number;
  ramUsedGb: number;

  inferenceSettings: InferenceSettings;
  appSettings: AppSettings;
  notifications: TrayNotification[];

  sshKeys: SshKeyProfile[];
  activeSshKeyId: string;
  sshHosts: SshHostEntry[];
  sshSettings: SshGlobalSettings;
  githubAccess: GitHubAccessSettings;

  freeProviders: FreeProviderProfile[];
  activeProviderId: string;
  skills: AgentSkill[];
  memoryDocs: AgentMemoryDoc[];
  subagentConfig: SubagentConfig;
  subagentRuns: SubagentRun[];
  executionEnv: ExecutionEnvConfig;
  gateways: GatewayChannelConfig[];

  hydrateFromServer: () => Promise<void>;
  refreshHardwareProfile: (targetDir?: string) => Promise<void>;
  refreshLocalModels: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshProjectFiles: (projectId?: string) => Promise<void>;
  refreshProjectLogs: (projectId?: string) => Promise<void>;

  saveProject: (payload: SaveProjectPayload) => Promise<{ ok: boolean; project?: ProjectRecord; error?: string }>;
  selectProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<{ ok: boolean }>;
  createOrWriteProjectFile: (
    filePath: string,
    content: string,
    summary?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  execDirectCommand: (command: string) => Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number }>;
  runProjectGitAction: (
    action: 'status' | 'diff' | 'log' | 'commit' | 'fetch' | 'push' | 'init',
    message?: string,
  ) => Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number }>;
  undoLastProjectAction: () => Promise<{ ok: boolean; message: string }>;

  setActiveTab: (tab: AppTab) => void;
  openSettingsSection: (section: SettingsSectionId) => void;
  setSettingsSection: (section: SettingsSectionId) => void;
  setUiStyle: (style: UiStylePreset) => void;
  updateChatVisibility: (patch: Partial<ChatVisibilitySettings>) => void;
  applyChatLayoutPreset: (preset: 'full' | 'cline-focus' | 'minimal') => void;
  toggleTheme: () => void;
  setTrayOpen: (open: boolean) => void;
  setCenterPaneMode: (mode: 'chat' | 'file') => void;

  setActiveSession: (sessionId: string) => void;
  createNewSession: () => void;
  setAgentMode: (mode: AgentMode) => void;

  setActiveRole: (roleId: string, syncTemp?: boolean) => void;
  addCustomRole: (role: Omit<ModelRole, 'id' | 'isCustom'>) => void;
  deleteCustomRole: (roleId: string) => void;
  setPermissionPolicy: (ruleId: string, policy: PermissionPolicy) => void;
  toggleDirective: (directiveId: string) => void;
  addCustomDirective: (directive: Omit<ModelDirective, 'id' | 'isCustom'>) => void;
  setPipelineConfig: (name: string, stack: string) => void;
  updateStageRole: (stageId: string, roleId: string) => void;
  runSinglePipelineStage: (stageId: string) => Promise<void>;
  runFullPipeline: () => Promise<void>;
  resetPipeline: () => void;

  selectFile: (path: string, switchToPreview?: boolean) => Promise<void>;
  toggleFileContext: (path: string) => void;
  setIncludeProjectTree: (include: boolean) => void;
  setIncludeTerminalOutput: (include: boolean) => void;

  sendPrompt: (prompt: string) => Promise<void>;
  applyDiff: (messageId: string) => Promise<void>;
  rejectDiff: (messageId: string) => void;
  runCommand: (messageId: string) => Promise<void>;
  skipCommand: (messageId: string) => void;
  diagnoseCommandError: (messageId: string) => void;
  rollbackToCheckpoint: (checkpointId: string) => Promise<void>;

  selectLocalModel: (modelId: string) => Promise<{ ok: boolean; error?: string }>;
  deleteLocalModel: (modelId: string) => Promise<void>;
  startDownload: (payload: DownloadQueuePayload) => Promise<{ ok: boolean; error?: string }>;
  startDownloadFromCatalog: (item: ModelCatalogItem, quant?: string) => Promise<{ ok: boolean; error?: string }>;
  togglePauseDownload: (modelId: string) => Promise<void>;
  importLocalModelFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  pullOllamaModel: (modelName: string, ollamaUrl?: string) => Promise<{ ok: boolean; error?: string }>;

  updateInferenceSettings: (patch: Partial<InferenceSettings>) => void;
  updateAppSettings: (patch: Partial<AppSettings>) => void;
  toggleServerPower: () => void;
  markAllNotificationsRead: () => void;

  setActiveSshKey: (keyId: string) => void;
  addSshKey: (payload: {
    name: string;
    algorithm: SshAlgorithm;
    comment: string;
    hasPassphrase: boolean;
  }) => void;
  toggleSshKeyInAgent: (keyId: string) => void;
  deleteSshKey: (keyId: string) => void;
  addSshHost: (host: Omit<SshHostEntry, 'id' | 'status'>) => void;
  updateSshHost: (hostId: string, patch: Partial<SshHostEntry>) => void;
  deleteSshHost: (hostId: string) => void;
  testSshHostConnection: (hostId: string) => Promise<void>;
  updateSshSettings: (patch: Partial<SshGlobalSettings>) => void;
  updateGitHubAccess: (patch: Partial<GitHubAccessSettings>) => void;
  verifyGitHubAccess: () => Promise<void>;

  setActiveProvider: (providerId: string) => void;
  updateFreeProvider: (providerId: string, patch: Partial<FreeProviderProfile>) => void;
  fetchProviderModels: (providerId: string) => Promise<void>;

  toggleSkill: (skillId: string) => void;
  addSkill: (payload: {
    title: string;
    category: AgentSkill['category'];
    triggerHint: string;
    contentMarkdown: string;
    source?: AgentSkill['source'];
  }) => void;
  updateSkill: (skillId: string, patch: Partial<AgentSkill>) => void;
  deleteSkill: (skillId: string) => void;
  learnSkillFromMessage: (messageId: string) => void;

  updateMemoryDoc: (key: AgentMemoryKey, content: string) => void;
  appendMemoryFact: (fact: string) => void;

  updateSubagentConfig: (patch: Partial<SubagentConfig>) => void;
  launchSubagent: (payload: {
    title?: string;
    prompt: string;
    roleId?: string;
    providerId?: string;
  }) => Promise<void>;
  clearCompletedSubagents: () => void;

  setActiveExecutionEnv: (env: ExecutionEnvKind) => void;
  updateExecutionEnv: (patch: Partial<ExecutionEnvConfig>) => void;

  updateGateway: (platform: GatewayPlatform, patch: Partial<GatewayChannelConfig>) => void;
  verifyTelegramGateway: () => Promise<void>;
}

let modelPollTimer: ReturnType<typeof setInterval> | null = null;

function nowTime(): string {
  return new Date().toTimeString().slice(0, 8);
}

const FULL_CHAT_VISIBILITY: ChatVisibilitySettings = {
  showLeftSidebar: true,
  showProjectTree: true,
  showLocalModels: true,
  showSessionHistory: true,
  showSkillsMemoryTab: true,
  showRightInspector: true,
  showMascot: true,
  showTelemetry: true,
  showFreeProviderCard: true,
  showInferenceControls: true,
  showSubagentsPanel: true,
  showActiveContext: true,
  showToolbar: true,
  showExecutionEnvBar: true,
  showTaskBanner: true,
  showMessageHeaders: true,
  showTimestamps: true,
  showReadFilesChips: true,
  showDiffBlocks: true,
  showTerminalBlocks: true,
  showCheckpointBadges: true,
  showRoleSwitcher: true,
  showQuickPrompts: true,
  showComposerStatusRow: true,
};

function ensureDownloadPolling(get: () => KovaStore) {
  if (modelPollTimer) return;
  modelPollTimer = setInterval(() => {
    const models = get().localModels;
    const hasActive = models.some(
      (m) => m.status === 'downloading' || m.status === 'queued' || m.status === 'verifying',
    );
    if (!hasActive) {
      if (modelPollTimer) {
        clearInterval(modelPollTimer);
        modelPollTimer = null;
      }
      return;
    }
    void get().refreshLocalModels();
  }, 450);
}

export const useKovaStore = create<KovaStore>((set, get) => ({
  hydrated: false,
  activeTab: 'workstation',
  theme: 'dark',
  uiStyle: 'cline-vscode',
  settingsSection: 'ui-chat',
  chatVisibility: FULL_CHAT_VISIBILITY,
  trayOpen: false,

  hardwareProfile: null,
  hardwareLoading: false,
  hardwareError: null,

  projects: [],
  activeProjectId: '',
  projectLogs: [],
  projectsLoading: false,

  sessions: INITIAL_SESSIONS,
  activeSessionId: INITIAL_SESSIONS[0].id,
  agentMode: 'act',
  centerPaneMode: 'chat',

  roles: INITIAL_ROLES,
  activeRoleId: INITIAL_ROLES[0].id,
  permissions: INITIAL_PERMISSIONS,
  directives: INITIAL_DIRECTIVES,
  pipelineStages: INITIAL_PIPELINE_STAGES,
  pipelineProjectName: 'Kova Project',
  pipelineStack: 'TypeScript · Node · React',
  pipelineRunning: false,

  files: [],
  selectedFilePath: '',
  includeProjectTree: true,
  includeTerminalOutput: true,
  terminalHistory: [],

  checkpoints: [],

  localModels: [],
  activeModelId: '',
  serverStatus: 'stopped',
  tokensPerSec: 0,
  vramUsedGb: 0,
  ramUsedGb: 0,

  inferenceSettings: {
    gpuBackend: 'auto',
    detectedGpuName: 'Определение оборудования...',
    detectedBackend: 'CPU',
    temperature: 0.2,
    contextSize: 16384,
    gpuLayers: 99,
    maxVramGb: 0,
    maxRamGb: 8,
  },

  appSettings: {
    modelsDir: '~/.kova-studio/models',
    llamaServerPath: 'llama-server',
    autoCheckSha256: true,
    includeOpenFilesByDefault: true,
    includeTreeByDefault: true,
    cloudFallbackProvider: 'none',
    cloudFallbackKey: '',
  },

  notifications: [],

  sshKeys: INITIAL_SSH_KEYS,
  activeSshKeyId: INITIAL_SSH_KEYS[0].id,
  sshHosts: INITIAL_SSH_HOSTS,
  sshSettings: INITIAL_SSH_SETTINGS,
  githubAccess: INITIAL_GITHUB_SETTINGS,

  freeProviders: INITIAL_FREE_PROVIDERS,
  activeProviderId: INITIAL_FREE_PROVIDERS[0].id,
  skills: INITIAL_SKILLS,
  memoryDocs: INITIAL_MEMORY_DOCS,
  subagentConfig: INITIAL_SUBAGENT_CONFIG,
  subagentRuns: [],
  executionEnv: INITIAL_EXECUTION_ENV,
  gateways: INITIAL_GATEWAYS,

  hydrateFromServer: async () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    await Promise.all([
      get().refreshHardwareProfile(),
      get().refreshLocalModels(),
      get().refreshProjects(),
    ]);
  },

  refreshHardwareProfile: async (targetDir) => {
    set({ hardwareLoading: true, hardwareError: null });
    try {
      const qs = targetDir ? `?dir=${encodeURIComponent(targetDir)}` : '';
      const res = await fetch(`/api/hardware${qs}`);
      const data = (await res.json()) as {
        ok?: boolean;
        hardware?: HardwareProfile;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.hardware) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const hw = data.hardware;
      const primaryGpu = hw.gpus[0];
      const backendPref: GpuBackend =
        hw.recommendedBackend === 'cuda'
          ? 'cuda'
          : hw.recommendedBackend === 'rocm' || hw.recommendedBackend === 'metal'
            ? 'vulkan'
            : 'cpu';

      set((s) => ({
        hardwareProfile: hw,
        hardwareLoading: false,
        hardwareError: null,
        inferenceSettings: {
          ...s.inferenceSettings,
          gpuBackend: backendPref,
          detectedGpuName: hw.gpuDetected && primaryGpu ? primaryGpu.name : `CPU only (${hw.cpu.model})`,
          detectedBackend: hw.backendVersion,
          gpuLayers: hw.gpuDetected ? 99 : 0,
          maxVramGb: hw.totalVramGb,
          maxRamGb: hw.ram.totalGb,
        },
        ramUsedGb: Number((hw.ram.totalGb - hw.ram.freeGb).toFixed(2)),
      }));
    } catch (err) {
      set({
        hardwareLoading: false,
        hardwareError: err instanceof Error ? err.message : 'Не удалось определить параметры системы',
      });
    }
  },

  refreshLocalModels: async () => {
    try {
      const res = await fetch('/api/models/local');
      const data = (await res.json()) as {
        ok?: boolean;
        models?: LocalModel[];
        activeModelId?: string;
        modelsDir?: string;
      };
      if (!res.ok || !data.ok) return;

      const models = data.models ?? [];
      const activeId = data.activeModelId ?? '';
      const hasActiveDl = models.some(
        (m) => m.status === 'downloading' || m.status === 'queued' || m.status === 'verifying',
      );
      if (hasActiveDl) {
        ensureDownloadPolling(get);
      }

      set((s) => ({
        localModels: models,
        activeModelId: activeId,
        serverStatus: activeId ? 'ready' : 'stopped',
        appSettings: data.modelsDir ? { ...s.appSettings, modelsDir: data.modelsDir } : s.appSettings,
      }));
    } catch {
      // ignore transient poll failure
    }
  },

  refreshProjects: async () => {
    set({ projectsLoading: true });
    try {
      const res = await fetch('/api/projects');
      const data = (await res.json()) as {
        ok?: boolean;
        projects?: ProjectRecord[];
        activeProjectId?: string;
      };
      if (!res.ok || !data.ok) {
        set({ projectsLoading: false });
        return;
      }
      const projects = data.projects ?? [];
      const activeProjectId = data.activeProjectId || projects[0]?.id || '';
      const activeProj = projects.find((p) => p.id === activeProjectId);

      set((s) => ({
        projects,
        activeProjectId,
        projectsLoading: false,
        executionEnv: activeProj
          ? { ...s.executionEnv, localWorkdir: activeProj.folderPath }
          : s.executionEnv,
      }));

      if (activeProjectId) {
        await Promise.all([
          get().refreshProjectFiles(activeProjectId),
          get().refreshProjectLogs(activeProjectId),
        ]);
      } else {
        set({ files: [], selectedFilePath: '', projectLogs: [] });
      }
    } catch {
      set({ projectsLoading: false });
    }
  },

  refreshProjectFiles: async (projectId) => {
    const id = projectId || get().activeProjectId;
    if (!id) {
      set({ files: [], selectedFilePath: '' });
      return;
    }
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/files`);
      const data = (await res.json()) as {
        ok?: boolean;
        files?: Array<{
          path: string;
          name: string;
          folder: string;
          language: string;
          sizeBytes: number;
          tokensEstimate: number;
        }>;
      };
      if (!res.ok || !data.ok || !data.files) return;

      const existingMap = new Map<string, ProjectFile>();
      for (const f of get().files) {
        existingMap.set(f.path, f);
      }

      const nextFiles: ProjectFile[] = data.files.map((item) => {
        const prev = existingMap.get(item.path);
        return {
          path: item.path,
          name: item.name,
          folder: item.folder,
          language: item.language,
          sizeBytes: item.sizeBytes,
          content: prev?.content ?? '',
          originalContent: prev?.originalContent ?? '',
          inContext: prev?.inContext ?? false,
          tokensEstimate: item.tokensEstimate,
        };
      });

      const currentSel = get().selectedFilePath;
      const nextSel =
        currentSel && nextFiles.some((f) => f.path === currentSel)
          ? currentSel
          : nextFiles[0]?.path ?? '';

      set({ files: nextFiles, selectedFilePath: nextSel });
    } catch {
      // keep state
    }
  },

  refreshProjectLogs: async (projectId) => {
    const id = projectId || get().activeProjectId;
    if (!id) {
      set({ projectLogs: [] });
      return;
    }
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/logs`);
      const data = (await res.json()) as { ok?: boolean; logs?: ProjectActionLogEntry[] };
      if (res.ok && data.ok && Array.isArray(data.logs)) {
        set({ projectLogs: data.logs });
      }
    } catch {
      // ignore
    }
  },

  saveProject: async (payload) => {
    const url = payload.id ? `/api/projects/${encodeURIComponent(payload.id)}` : '/api/projects';
    const method = payload.id ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; project?: ProjectRecord; error?: string };
      if (!res.ok || !data.ok || !data.project) {
        return { ok: false, error: data.error || `Ошибка сохранения проекта (HTTP ${res.status})` };
      }

      await get().refreshProjects();
      set((s) => ({
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: `Проект «${data.project!.name}» подключён`,
            detail: data.project!.folderPath,
            timestamp: nowTime(),
            read: false,
          },
          ...s.notifications,
        ],
      }));
      return { ok: true, project: data.project };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Сетевая ошибка сохранения проекта' };
    }
  },

  selectProject: async (projectId) => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/activate`, {
        method: 'POST',
      });
      if (!res.ok) return;
      const proj = get().projects.find((p) => p.id === projectId);
      set((s) => ({
        activeProjectId: projectId,
        executionEnv: proj ? { ...s.executionEnv, localWorkdir: proj.folderPath } : s.executionEnv,
      }));
      await Promise.all([get().refreshProjectFiles(projectId), get().refreshProjectLogs(projectId)]);
    } catch {
      // ignore
    }
  },

  deleteProject: async (projectId) => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { ok?: boolean };
      await get().refreshProjects();
      return { ok: Boolean(data.ok) };
    } catch {
      return { ok: false };
    }
  },

  createOrWriteProjectFile: async (filePath, content, summary) => {
    const projectId = get().activeProjectId;
    if (!projectId) {
      return { ok: false, error: 'Сначала выберите или создайте проект с папкой' };
    }
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content, summary }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `HTTP ${res.status}` };
      }
      await Promise.all([get().refreshProjectFiles(projectId), get().refreshProjectLogs(projectId)]);
      await get().selectFile(filePath, true);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Ошибка записи файла' };
    }
  },

  execDirectCommand: async (command) => {
    const projectId = get().activeProjectId;
    if (!projectId) {
      return {
        ok: false,
        stdout: '',
        stderr: 'Нет активного проекта. Выберите или создайте проект с папкой.',
        exitCode: 1,
      };
    }
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      error?: string;
    };
    await get().refreshProjectLogs(projectId);
    const outLines = [
      `$ ${command}`,
      ...(data.stdout ? data.stdout.split('\n') : []),
      ...(data.stderr ? data.stderr.split('\n') : []),
    ];
    set((s) => ({ terminalHistory: [...s.terminalHistory.slice(-16), ...outLines] }));
    return {
      ok: Boolean(data.ok),
      stdout: data.stdout ?? '',
      stderr: data.stderr ?? data.error ?? '',
      exitCode: typeof data.exitCode === 'number' ? data.exitCode : 1,
    };
  },

  runProjectGitAction: async (action, message) => {
    const projectId = get().activeProjectId;
    if (!projectId) {
      return { ok: false, stdout: '', stderr: 'Нет активного проекта', exitCode: 1 };
    }
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, message }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      error?: string;
    };
    await get().refreshProjectLogs(projectId);
    return {
      ok: Boolean(data.ok),
      stdout: data.stdout ?? '',
      stderr: data.stderr ?? data.error ?? '',
      exitCode: typeof data.exitCode === 'number' ? data.exitCode : 1,
    };
  },

  undoLastProjectAction: async () => {
    const projectId = get().activeProjectId;
    if (!projectId) {
      return { ok: false, message: 'Нет активного проекта для отката.' };
    }
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/undo`, {
      method: 'POST',
    });
    const data = (await res.json()) as { ok?: boolean; message?: string; restoredFile?: string };
    await Promise.all([get().refreshProjectFiles(projectId), get().refreshProjectLogs(projectId)]);
    if (get().selectedFilePath) {
      await get().selectFile(get().selectedFilePath, false);
    }
    return {
      ok: Boolean(data.ok),
      message: data.message || 'Откат не выполнен',
    };
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  openSettingsSection: (section) => set({ activeTab: 'settings', settingsSection: section }),
  setSettingsSection: (section) => set({ settingsSection: section }),
  setUiStyle: (uiStyle) => set({ uiStyle }),

  updateChatVisibility: (patch) =>
    set((s) => ({
      chatVisibility: { ...s.chatVisibility, ...patch },
    })),

  applyChatLayoutPreset: (preset) =>
    set(() => {
      if (preset === 'full') return { chatVisibility: { ...FULL_CHAT_VISIBILITY } };
      if (preset === 'cline-focus') {
        return {
          chatVisibility: {
            ...FULL_CHAT_VISIBILITY,
            showLeftSidebar: false,
            showRightInspector: false,
            showQuickPrompts: false,
          },
        };
      }
      return {
        chatVisibility: {
          ...FULL_CHAT_VISIBILITY,
          showLeftSidebar: false,
          showRightInspector: false,
          showToolbar: false,
          showExecutionEnvBar: false,
          showTaskBanner: false,
          showMessageHeaders: false,
          showTimestamps: false,
          showReadFilesChips: false,
          showCheckpointBadges: false,
          showRoleSwitcher: false,
          showQuickPrompts: false,
          showComposerStatusRow: false,
        },
      };
    }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return { theme: next };
    }),

  setTrayOpen: (open) => set({ trayOpen: open }),
  setCenterPaneMode: (mode) => set({ centerPaneMode: mode }),

  setActiveSession: (sessionId) => {
    const target = get().sessions.find((s) => s.id === sessionId);
    set({
      activeSessionId: sessionId,
      agentMode: target?.mode ?? get().agentMode,
      centerPaneMode: 'chat',
    });
  },

  createNewSession: () => {
    const id = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title: 'Новая задача разработки',
      updatedAt: 'Сейчас',
      mode: get().agentMode,
      messages: [],
    };
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: id,
      centerPaneMode: 'chat',
    }));
  },

  setAgentMode: (mode) =>
    set((state) => ({
      agentMode: mode,
      sessions: state.sessions.map((s) =>
        s.id === state.activeSessionId ? { ...s, mode } : s,
      ),
    })),

  setActiveRole: (roleId, syncTemp = true) => {
    const role = get().roles.find((r) => r.id === roleId);
    if (!role) return;
    set((state) => ({
      activeRoleId: roleId,
      agentMode: role.defaultMode,
      inferenceSettings: syncTemp
        ? { ...state.inferenceSettings, temperature: role.recommendedTemp }
        : state.inferenceSettings,
    }));
  },

  addCustomRole: (role) => {
    const id = `role-custom-${Date.now()}`;
    const created: ModelRole = { ...role, id, isCustom: true };
    set((state) => ({
      roles: [...state.roles, created],
      activeRoleId: id,
      agentMode: created.defaultMode,
      inferenceSettings: {
        ...state.inferenceSettings,
        temperature: created.recommendedTemp,
      },
    }));
  },

  deleteCustomRole: (roleId) =>
    set((state) => {
      const nextRoles = state.roles.filter((r) => r.id !== roleId || !r.isCustom);
      const nextActive =
        state.activeRoleId === roleId ? nextRoles[0]?.id ?? 'role-developer' : state.activeRoleId;
      return { roles: nextRoles, activeRoleId: nextActive };
    }),

  setPermissionPolicy: (ruleId, policy) =>
    set((state) => ({
      permissions: state.permissions.map((p) => (p.id === ruleId ? { ...p, policy } : p)),
    })),

  toggleDirective: (directiveId) =>
    set((state) => ({
      directives: state.directives.map((d) =>
        d.id === directiveId ? { ...d, enabled: !d.enabled } : d,
      ),
    })),

  addCustomDirective: (directive) => {
    const id = `dir-custom-${Date.now()}`;
    set((state) => ({
      directives: [{ ...directive, id, isCustom: true }, ...state.directives],
    }));
  },

  setPipelineConfig: (name, stack) => set({ pipelineProjectName: name, pipelineStack: stack }),

  updateStageRole: (stageId, roleId) =>
    set((state) => ({
      pipelineStages: state.pipelineStages.map((st) =>
        st.id === stageId ? { ...st, assignedRoleId: roleId } : st,
      ),
    })),

  resetPipeline: () =>
    set((state) => ({
      pipelineRunning: false,
      pipelineStages: state.pipelineStages.map((st) => ({
        ...st,
        status: 'idle',
        resultNote: undefined,
      })),
    })),

  runSinglePipelineStage: async (stageId) => {
    const state = get();
    const stage = state.pipelineStages.find((s) => s.id === stageId);
    if (!stage) return;
    const role = state.roles.find((r) => r.id === stage.assignedRoleId) ?? state.roles[0];
    const provider =
      state.freeProviders.find((p) => p.id === state.activeProviderId) ?? state.freeProviders[0];

    set((s) => ({
      serverStatus: 'generating',
      pipelineStages: s.pipelineStages.map((st) =>
        st.id === stageId ? { ...st, status: 'running', resultNote: undefined } : st,
      ),
    }));

    try {
      const resp = await fetch('/api/providers/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: provider.selectedModel,
          temperature: role.recommendedTemp,
          messages: [
            { role: 'system', content: role.systemPrompt },
            {
              role: 'user',
              content: `Проект: ${state.pipelineProjectName} (${state.pipelineStack}). Этап: ${stage.title}. Цель: ${stage.shortGoal}. Артефакт: ${stage.outputArtifact}.`,
            },
          ],
        }),
      });
      const json = (await resp.json()) as { ok?: boolean; content?: string; error?: string };
      if (!resp.ok || !json.ok || !json.content) {
        throw new Error(json.error || `Провайдер ${provider.name} недоступен (HTTP ${resp.status})`);
      }

      set((s) => ({
        serverStatus: s.activeModelId ? 'ready' : 'stopped',
        pipelineStages: s.pipelineStages.map((st) =>
          st.id === stageId
            ? { ...st, status: 'done', resultNote: json.content!.slice(0, 260) }
            : st,
        ),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка запуска этапа';
      set((s) => ({
        serverStatus: s.activeModelId ? 'ready' : 'stopped',
        pipelineStages: s.pipelineStages.map((st) =>
          st.id === stageId ? { ...st, status: 'error', resultNote: `Ошибка: ${msg}` } : st,
        ),
      }));
    }
  },

  runFullPipeline: async () => {
    if (get().pipelineRunning) return;
    get().resetPipeline();
    set({ pipelineRunning: true });
    const stageIds = get().pipelineStages.map((s) => s.id);
    for (const id of stageIds) {
      await get().runSinglePipelineStage(id);
    }
    set({ pipelineRunning: false });
  },

  selectFile: async (filePath, switchToPreview = false) => {
    set((state) => ({
      selectedFilePath: filePath,
      centerPaneMode: switchToPreview ? 'file' : state.centerPaneMode,
    }));

    const projectId = get().activeProjectId;
    if (!projectId || !filePath) return;

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(filePath)}`,
      );
      const data = (await res.json()) as { ok?: boolean; content?: string };
      if (!res.ok || !data.ok || typeof data.content !== 'string') return;
      const content = data.content;
      set((s) => ({
        files: s.files.map((f) =>
          f.path === filePath
            ? {
                ...f,
                content,
                originalContent: content,
                tokensEstimate: Math.max(1, Math.round(content.length / 4)),
              }
            : f,
        ),
      }));
    } catch {
      // ignore
    }
  },

  toggleFileContext: (path) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.path === path ? { ...f, inContext: !f.inContext } : f,
      ),
    })),

  setIncludeProjectTree: (include) => set({ includeProjectTree: include }),
  setIncludeTerminalOutput: (include) => set({ includeTerminalOutput: include }),

  sendPrompt: async (prompt) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const state = get();
    const sessionId = state.activeSessionId;
    const mode = state.agentMode;

    const pushReply = (
      replyText: string,
      opts: {
        roleName?: string;
        providerLabel?: string;
        readFiles?: string[];
        diff?: ChatSession['messages'][number]['diff'];
        command?: ChatSession['messages'][number]['command'];
      } = {},
    ) => {
      set((s) => ({
        centerPaneMode: 'chat',
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId
            ? {
                ...sess,
                title: sess.messages.length === 0 ? trimmed.slice(0, 44) : sess.title,
                updatedAt: 'Сейчас',
                messages: [
                  ...sess.messages,
                  {
                    id: `msg-u-${Date.now()}`,
                    role: 'user',
                    mode,
                    timestamp: nowTime(),
                    content: trimmed,
                  },
                  {
                    id: `msg-a-${Date.now() + 1}`,
                    role: 'assistant',
                    mode,
                    roleName: opts.roleName,
                    providerLabel: opts.providerLabel,
                    timestamp: nowTime(),
                    content: replyText,
                    readFiles: opts.readFiles,
                    diff: opts.diff,
                    command: opts.command,
                  },
                ],
              }
            : sess,
        ),
      }));
    };

    // Handle local configuration slash commands
    if (trimmed.startsWith('/')) {
      const [cmdRaw, ...restParts] = trimmed.split(/\s+/);
      const cmd = cmdRaw.toLowerCase();
      const arg = restParts.join(' ').trim();

      if (cmd === '/subagent') {
        if (!arg) {
          pushReply('Укажите задачу для субагента: `/subagent Проверь код проекта`');
          return;
        }
        await get().launchSubagent({ prompt: arg });
        return;
      }

      if (cmd === '/memory') {
        if (!arg) {
          pushReply('Укажите факт для сохранения в `MEMORY.md`: `/memory <факт>`');
          return;
        }
        get().appendMemoryFact(arg);
        pushReply(`Факт сохранён в \`MEMORY.md\`:\n\n- ${arg}`, { roleName: 'OpenKova Memory' });
        return;
      }

      if (cmd === '/env') {
        const nextEnv =
          arg === 'ssh' || arg === 'docker' || arg === 'local'
            ? (arg as ExecutionEnvKind)
            : null;
        if (!nextEnv) {
          pushReply(`Текущая среда: \`${state.executionEnv.activeEnv}\`. Доступно: \`/env local\`, \`/env ssh\`, \`/env docker\`.`);
          return;
        }
        get().setActiveExecutionEnv(nextEnv);
        pushReply(`Среда выполнения переключена на **${nextEnv.toUpperCase()}**.`);
        return;
      }

      if (cmd === '/provider') {
        const matched = state.freeProviders.find(
          (p) => p.kind.includes(arg.toLowerCase()) || p.name.toLowerCase().includes(arg.toLowerCase()),
        );
        if (!arg || !matched) {
          const list = state.freeProviders.map((p) => `- \`${p.kind}\` (${p.name})`).join('\n');
          pushReply(`Доступные провайдеры:\n${list}`);
          return;
        }
        get().setActiveProvider(matched.id);
        pushReply(`Активный провайдер переключён на **${matched.name}** (\`${matched.selectedModel}\`).`);
        return;
      }

      if (cmd === '/skill') {
        if (!arg) {
          const activeList = state.skills
            .filter((sk) => sk.enabled)
            .map((sk) => `- **${sk.title}** (\`${sk.slug}\`)`)
            .join('\n');
          pushReply(`Активные навыки (\`SKILL.md\`):\n${activeList}`);
          return;
        }
        get().addSkill({
          title: arg,
          category: 'Разработка',
          triggerHint: 'По ключевым словам в чате',
          contentMarkdown: `---\nname: ${arg.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')}\n---\nИнструкция навыка: ${arg}`,
          source: 'custom',
        });
        pushReply(`Новый навык **«${arg}»** добавлен в \`SKILL.md\`.`);
        return;
      }
    }

    const activeRole = state.roles.find((r) => r.id === state.activeRoleId) ?? state.roles[0];
    const activeProvider =
      state.freeProviders.find((p) => p.id === state.activeProviderId) ?? state.freeProviders[0];
    const activeSkills = state.skills.filter((sk) => sk.enabled);
    const activeProj = state.projects.find((p) => p.id === state.activeProjectId);

    const systemContext = [
      activeRole.systemPrompt,
      state.memoryDocs.map((m) => `### ${m.filename}\n${m.content}`).join('\n\n'),
      activeSkills.length > 0
        ? `### Активные навыки\n${activeSkills.map((s) => `- ${s.title}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    set({ serverStatus: 'generating' });

    try {
      if (activeProj) {
        const res = await fetch(`/api/projects/${encodeURIComponent(activeProj.id)}/task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmed,
            mode,
            provider: {
              baseUrl: activeProvider.baseUrl,
              apiKey: activeProvider.apiKey,
              model: activeProvider.selectedModel,
              temperature: state.inferenceSettings.temperature,
              systemPrompt: systemContext,
            },
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          replyText?: string;
          readFiles?: string[];
          commandResult?: {
            command: string;
            cwd: string;
            stdout: string;
            stderr: string;
            exitCode: number;
          };
          proposedCommand?: string;
          diff?: { filePath: string; oldContent: string; newContent: string; summary: string };
          usedLiveLlm?: boolean;
        };

        if (!res.ok || !data.ok) {
          pushReply(`Ошибка выполнения задачи: ${data.error || `HTTP ${res.status}`}`, {
            roleName: activeRole.name,
            providerLabel: activeProj.name,
          });
          set({ serverStatus: state.activeModelId ? 'ready' : 'stopped' });
          return;
        }

        const cmdObj = data.commandResult
          ? {
              id: `cmd-${Date.now()}`,
              shell: 'sh' as const,
              command: data.commandResult.command,
              cwd: data.commandResult.cwd,
              description: 'Реальное выполнение команды в папке проекта',
              status: (data.commandResult.exitCode === 0 ? 'success' : 'failed') as 'success' | 'failed',
              exitCode: data.commandResult.exitCode,
              output: [
                `$ ${data.commandResult.command}`,
                ...(data.commandResult.stdout ? data.commandResult.stdout.split('\n') : []),
                ...(data.commandResult.stderr ? data.commandResult.stderr.split('\n') : []),
                `Exit code: ${data.commandResult.exitCode}`,
              ],
              canDiagnose: data.commandResult.exitCode !== 0,
            }
          : data.proposedCommand
            ? {
                id: `cmd-${Date.now()}`,
                shell: 'sh' as const,
                command: data.proposedCommand,
                cwd: activeProj.folderPath,
                description: 'Команда готова к реальному запуску',
                status: 'pending' as const,
                output: [],
              }
            : undefined;

        const diffObj = data.diff
          ? {
              id: `diff-${Date.now()}`,
              filePath: data.diff.filePath,
              summary: data.diff.summary,
              oldContent: data.diff.oldContent,
              newContent: data.diff.newContent,
              status: 'applied' as const,
            }
          : undefined;

        pushReply(data.replyText || 'Задача выполнена.', {
          roleName: activeRole.name,
          providerLabel: data.usedLiveLlm
            ? `${activeProvider.name} · ${activeProvider.selectedModel}`
            : `Проект: ${activeProj.name}`,
          readFiles: data.readFiles,
          diff: diffObj,
          command: cmdObj,
        });

        await Promise.all([
          get().refreshProjectFiles(activeProj.id),
          get().refreshProjectLogs(activeProj.id),
        ]);
      } else {
        // No project selected yet: run real provider chat if reachable, otherwise ask to create/select a project
        const resp = await fetch('/api/providers/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: activeProvider.baseUrl,
            apiKey: activeProvider.apiKey,
            model: activeProvider.selectedModel,
            temperature: state.inferenceSettings.temperature,
            messages: [
              { role: 'system', content: systemContext },
              { role: 'user', content: trimmed },
            ],
          }),
        });
        const json = (await resp.json()) as { ok?: boolean; content?: string; error?: string };
        if (resp.ok && json.ok && json.content) {
          pushReply(json.content, {
            roleName: activeRole.name,
            providerLabel: `${activeProvider.name} · ${activeProvider.selectedModel}`,
          });
        } else {
          pushReply(
            `Активный проект не выбран, а провайдер **${activeProvider.name}** не ответил (${json.error || `HTTP ${resp.status}`}).\n\n` +
              `Чтобы работать с реальными файлами, терминалом, Git и \`/undo\`, создайте или выберите проект с папкой на левой панели **«Проекты»**.`,
            { roleName: activeRole.name },
          );
        }
      }
    } catch (err) {
      pushReply(
        `Ошибка запроса: ${err instanceof Error ? err.message : 'Сетевая ошибка'}`,
        { roleName: activeRole.name },
      );
    } finally {
      set({ serverStatus: get().activeModelId ? 'ready' : 'stopped' });
    }
  },

  applyDiff: async (messageId) => {
    const state = get();
    const activeSession = state.sessions.find((s) => s.id === state.activeSessionId);
    const targetMsg = activeSession?.messages.find((m) => m.id === messageId);
    const diff = targetMsg?.diff;
    if (!diff || diff.status !== 'pending') return;

    const writeRes = await get().createOrWriteProjectFile(diff.filePath, diff.newContent, diff.summary);
    if (!writeRes.ok) return;

    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === s.activeSessionId
          ? {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === messageId && m.diff ? { ...m, diff: { ...m.diff, status: 'applied' } } : m,
              ),
            }
          : sess,
      ),
    }));
  },

  rejectDiff: (messageId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === s.activeSessionId
          ? {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === messageId && m.diff ? { ...m, diff: { ...m.diff, status: 'rejected' } } : m,
              ),
            }
          : sess,
      ),
    }));
  },

  runCommand: async (messageId) => {
    const state = get();
    const sessionId = state.activeSessionId;
    const targetMsg = state.sessions
      .find((s) => s.id === sessionId)
      ?.messages.find((m) => m.id === messageId);
    const cmd = targetMsg?.command;
    if (!cmd) return;

    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === messageId && m.command
                  ? { ...m, command: { ...m.command, status: 'running', output: [`$ ${cmd.command}`] } }
                  : m,
              ),
            }
          : sess,
      ),
    }));

    const result = await get().execDirectCommand(cmd.command);
    const lines = [
      `$ ${cmd.command}`,
      ...(result.stdout ? result.stdout.split('\n') : []),
      ...(result.stderr ? result.stderr.split('\n') : []),
      `Exit code: ${result.exitCode}`,
    ];

    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === messageId && m.command
                  ? {
                      ...m,
                      command: {
                        ...m.command,
                        status: result.exitCode === 0 ? 'success' : 'failed',
                        exitCode: result.exitCode,
                        output: lines,
                        canDiagnose: result.exitCode !== 0,
                      },
                    }
                  : m,
              ),
            }
          : sess,
      ),
    }));
  },

  skipCommand: (messageId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === s.activeSessionId
          ? {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === messageId && m.command
                  ? { ...m, command: { ...m.command, status: 'skipped' } }
                  : m,
              ),
            }
          : sess,
      ),
    }));
  },

  diagnoseCommandError: (messageId) => {
    const state = get();
    const targetMsg = state.sessions
      .find((s) => s.id === state.activeSessionId)
      ?.messages.find((m) => m.id === messageId);
    if (!targetMsg?.command) return;

    void get().sendPrompt(
      `Проанализируй ошибку выполнения команды "${targetMsg.command.command}":\n${targetMsg.command.output.join('\n')}`,
    );
  },

  rollbackToCheckpoint: async () => {
    const res = await get().undoLastProjectAction();
    set((s) => ({
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: res.ok ? 'Откат /undo выполнен' : 'Откат невозможен',
          detail: res.message,
          timestamp: nowTime(),
          read: false,
        },
        ...s.notifications,
      ],
    }));
  },

  selectLocalModel: async (modelId) => {
    try {
      const res = await fetch(`/api/models/local/${encodeURIComponent(modelId)}/activate`, {
        method: 'POST',
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; activeModelId?: string };
      if (!res.ok || !data.ok) {
        set((s) => ({
          notifications: [
            {
              id: `notif-${Date.now()}`,
              title: 'Ошибка активации модели',
              detail: data.error || `HTTP ${res.status}`,
              timestamp: nowTime(),
              read: false,
            },
            ...s.notifications,
          ],
        }));
        return { ok: false, error: data.error };
      }

      await get().refreshLocalModels();
      const model = get().localModels.find((m) => m.id === modelId);
      set((s) => ({
        activeModelId: modelId,
        serverStatus: 'ready',
        vramUsedGb: model ? Math.min(s.inferenceSettings.maxVramGb, model.minVramGb) : 0,
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: `Активирована модель ${model?.name ?? modelId}`,
            detail: model?.localPath ?? '',
            timestamp: nowTime(),
            read: false,
          },
          ...s.notifications,
        ],
      }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Ошибка активации' };
    }
  },

  deleteLocalModel: async (modelId) => {
    try {
      await fetch(`/api/models/local/${encodeURIComponent(modelId)}`, { method: 'DELETE' });
      await Promise.all([get().refreshLocalModels(), get().refreshHardwareProfile()]);
    } catch {
      // ignore
    }
  },

  startDownload: async (payload) => {
    try {
      const res = await fetch('/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: payload.repoId,
          name: payload.name,
          quant: payload.quant,
          filename: payload.filename,
          downloadUrl: payload.downloadUrl,
          sizeGb: payload.sizeGb,
          totalBytes: payload.totalBytes,
          minVramGb: payload.minVramGb,
          minRamGb: payload.minRamGb,
          license: payload.license,
          expectedSha256: payload.sha256 ?? null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `HTTP ${res.status}` };
      }
      await get().refreshLocalModels();
      ensureDownloadPolling(get);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Ошибка старта загрузки' };
    }
  },

  startDownloadFromCatalog: async (item, quant) => {
    const selectedQuant = quant || item.defaultQuant || 'Q4_K_M';
    let variant = item.files?.find((f) => f.quant === selectedQuant);

    // If catalog item lacks resolved file URL/SHA256, fetch real blob metadata from HF API first
    if (!variant && item.source === 'huggingface') {
      try {
        const res = await fetch(`/api/hf/model?repoId=${encodeURIComponent(item.repoId)}`);
        const data = (await res.json()) as {
          files?: Array<{
            filename: string;
            quant: string;
            sizeBytes: number;
            sizeGb: number;
            sha256: string | null;
            downloadUrl: string;
          }>;
        };
        if (res.ok && Array.isArray(data.files) && data.files.length > 0) {
          variant =
            data.files.find((f) => f.quant === selectedQuant) ??
            data.files.find((f) => f.quant.includes('Q4')) ??
            data.files[0];
        }
      } catch {
        // handled below
      }
    }

    if (!variant?.downloadUrl) {
      return {
        ok: false,
        error: `Для ${item.repoId} (${selectedQuant}) не найден прямой файл .gguf. Откройте «Файлы GGUF» и выберите конкретный файл.`,
      };
    }

    return get().startDownload({
      repoId: item.repoId,
      name: item.name,
      quant: variant.quant || selectedQuant,
      filename: variant.filename,
      downloadUrl: variant.downloadUrl,
      sizeGb: variant.sizeGb || item.sizeGb,
      totalBytes: variant.sizeBytes || undefined,
      minVramGb: item.minVramGb,
      minRamGb: item.minRamGb,
      license: item.license,
      sha256: variant.sha256 ?? null,
    });
  },

  togglePauseDownload: async (modelId) => {
    const target = get().localModels.find((m) => m.id === modelId);
    if (!target) return;
    const action = target.status === 'downloading' ? 'pause' : 'resume';
    await fetch(`/api/models/download/${encodeURIComponent(modelId)}/${action}`, {
      method: 'POST',
    });
    await get().refreshLocalModels();
    if (action === 'resume') {
      ensureDownloadPolling(get);
    }
  },

  importLocalModelFile: async (filePath) => {
    try {
      const res = await fetch('/api/models/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `HTTP ${res.status}` };
      }
      await get().refreshLocalModels();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Ошибка импорта' };
    }
  },

  pullOllamaModel: async (modelName, ollamaUrl) => {
    try {
      const res = await fetch('/api/models/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName, ollamaUrl }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `HTTP ${res.status}` };
      }
      await get().refreshLocalModels();
      ensureDownloadPolling(get);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Ошибка Ollama pull' };
    }
  },

  updateInferenceSettings: (patch) =>
    set((s) => ({
      inferenceSettings: { ...s.inferenceSettings, ...patch },
    })),

  updateAppSettings: (patch) =>
    set((s) => ({
      appSettings: { ...s.appSettings, ...patch },
    })),

  toggleServerPower: () =>
    set((s) => ({
      serverStatus: s.serverStatus === 'stopped' ? (s.activeModelId ? 'ready' : 'stopped') : 'stopped',
      tokensPerSec: 0,
    })),

  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  setActiveSshKey: (keyId) =>
    set((s) => {
      const target = s.sshKeys.find((k) => k.id === keyId);
      if (!target) return s;
      return {
        activeSshKeyId: keyId,
        sshHosts: s.sshHosts.map((h) =>
          h.alias === 'github.com' ? { ...h, identityFile: target.privateKeyPath } : h,
        ),
      };
    }),

  addSshKey: ({ name, algorithm, comment, hasPassphrase }) =>
    set((s) => {
      const slug =
        name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom';
      const prefix =
        algorithm === 'rsa-4096' ? 'id_rsa' : algorithm === 'ecdsa' ? 'id_ecdsa' : 'id_ed25519';
      const newKey: SshKeyProfile = {
        id: `ssh-key-${Date.now()}`,
        name: name.trim() || `Ключ ${algorithm.toUpperCase()}`,
        algorithm,
        comment: comment.trim() || s.githubAccess.gitUserEmail,
        privateKeyPath: `${s.sshSettings.defaultKeyDir.replace(/\\$/, '')}\\${prefix}_${slug}`,
        publicKey: `# Сгенерируйте ключ локально: ssh-keygen -t ${algorithm} -f ~/.ssh/${prefix}_${slug}`,
        fingerprint: 'Ожидает генерации через ssh-keygen',
        hasPassphrase,
        addedToAgent: s.sshSettings.openSshAgentAutoStart,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      return { sshKeys: [newKey, ...s.sshKeys], activeSshKeyId: newKey.id };
    }),

  toggleSshKeyInAgent: (keyId) =>
    set((s) => ({
      sshKeys: s.sshKeys.map((k) => (k.id === keyId ? { ...k, addedToAgent: !k.addedToAgent } : k)),
    })),

  deleteSshKey: (keyId) =>
    set((s) => {
      if (s.sshKeys.length <= 1) return s;
      const next = s.sshKeys.filter((k) => k.id !== keyId);
      const nextActive = s.activeSshKeyId === keyId ? next[0].id : s.activeSshKeyId;
      return { sshKeys: next, activeSshKeyId: nextActive };
    }),

  addSshHost: (host) =>
    set((s) => ({
      sshHosts: [...s.sshHosts, { ...host, id: `host-${Date.now()}`, status: 'untested' }],
    })),

  updateSshHost: (hostId, patch) =>
    set((s) => ({
      sshHosts: s.sshHosts.map((h) => (h.id === hostId ? { ...h, ...patch } : h)),
    })),

  deleteSshHost: (hostId) =>
    set((s) => ({
      sshHosts: s.sshHosts.filter((h) => h.id !== hostId),
    })),

  testSshHostConnection: async (hostId) => {
    const target = get().sshHosts.find((h) => h.id === hostId);
    if (!target) return;

    set((s) => ({
      sshHosts: s.sshHosts.map((h) =>
        h.id === hostId ? { ...h, lastChecked: 'Выполняется реальная проверка ssh...' } : h,
      ),
    }));

    try {
      const res = await fetch('/api/ssh/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: target.hostName,
          port: target.port,
          user: target.user,
          identityFile: target.identityFile,
          remotePath: '/tmp',
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; latencyMs?: number };
      set((s) => ({
        sshHosts: s.sshHosts.map((h) =>
          h.id === hostId
            ? {
                ...h,
                status: data.ok ? 'connected' : 'error',
                lastChecked: data.ok
                  ? `SSH OK (${data.latencyMs ?? 0} мс) · ${nowTime()}`
                  : data.error || 'SSH-проверка отклонена',
              }
            : h,
        ),
      }));
    } catch (err) {
      set((s) => ({
        sshHosts: s.sshHosts.map((h) =>
          h.id === hostId
            ? {
                ...h,
                status: 'error',
                lastChecked: err instanceof Error ? err.message : 'Сетевая ошибка SSH',
              }
            : h,
        ),
      }));
    }
  },

  updateSshSettings: (patch) =>
    set((s) => ({ sshSettings: { ...s.sshSettings, ...patch } })),

  updateGitHubAccess: (patch) =>
    set((s) => ({ githubAccess: { ...s.githubAccess, ...patch } })),

  verifyGitHubAccess: async () => {
    const { githubAccess } = get();
    set((s) => ({
      githubAccess: {
        ...s.githubAccess,
        lastVerifyStatus: 'checking',
        lastVerifyMessage: 'Проверка соединения с GitHub API...',
      },
    }));

    try {
      const resp = await fetch('/api/github/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: githubAccess.repoOwnerSlashName,
          token: githubAccess.authMethod === 'pat' ? githubAccess.tokenInput : '',
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        authUser?: string | null;
        grantedScopes?: string[];
        repo?: { fullName: string; isPrivate: boolean; defaultBranch: string; stars: number };
      };

      if (!resp.ok || !data.ok) {
        set((s) => ({
          githubAccess: {
            ...s.githubAccess,
            lastVerifyStatus: 'error',
            lastVerifyMessage: data.error || `Ошибка проверки (HTTP ${resp.status})`,
          },
        }));
        return;
      }

      const parts: string[] = [];
      if (data.authUser) parts.push(`Аккаунт: @${data.authUser}`);
      if (data.repo) {
        parts.push(
          `Репозиторий: ${data.repo.fullName} (${data.repo.isPrivate ? 'Private' : 'Public'}, ветка ${data.repo.defaultBranch})`,
        );
      }
      if (data.grantedScopes && data.grantedScopes.length > 0) {
        parts.push(`Права токена: ${data.grantedScopes.join(', ')}`);
      }

      set((s) => ({
        githubAccess: {
          ...s.githubAccess,
          lastVerifyStatus: 'ok',
          lastVerifyMessage: parts.join(' · ') || 'Доступ к GitHub подтверждён',
        },
      }));
    } catch (err) {
      set((s) => ({
        githubAccess: {
          ...s.githubAccess,
          lastVerifyStatus: 'error',
          lastVerifyMessage: err instanceof Error ? err.message : 'Сетевая ошибка при проверке GitHub',
        },
      }));
    }
  },

  setActiveProvider: (providerId) => set({ activeProviderId: providerId }),

  updateFreeProvider: (providerId, patch) =>
    set((s) => ({
      freeProviders: s.freeProviders.map((p) => (p.id === providerId ? { ...p, ...patch } : p)),
    })),

  fetchProviderModels: async (providerId) => {
    const provider = get().freeProviders.find((p) => p.id === providerId);
    if (!provider) return;

    set((s) => ({
      freeProviders: s.freeProviders.map((p) =>
        p.id === providerId
          ? { ...p, status: 'checking', lastCheckMessage: 'Запрос списка моделей...' }
          : p,
      ),
    }));

    try {
      const resp = await fetch('/api/providers/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: provider.kind,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        models?: string[];
        count?: number;
        error?: string;
      };

      if (!resp.ok || !data.ok) {
        set((s) => ({
          freeProviders: s.freeProviders.map((p) =>
            p.id === providerId
              ? { ...p, status: 'error', lastCheckMessage: data.error || `HTTP ${resp.status}` }
              : p,
          ),
        }));
        return;
      }

      const models = data.models && data.models.length > 0 ? data.models : provider.availableModels;
      set((s) => ({
        freeProviders: s.freeProviders.map((p) =>
          p.id === providerId
            ? {
                ...p,
                status: 'connected',
                availableModels: models,
                selectedModel: models.includes(p.selectedModel) ? p.selectedModel : models[0],
                lastCheckMessage: `Доступно моделей: ${data.count ?? models.length}`,
              }
            : p,
        ),
      }));
    } catch (err) {
      set((s) => ({
        freeProviders: s.freeProviders.map((p) =>
          p.id === providerId
            ? {
                ...p,
                status: 'error',
                lastCheckMessage: err instanceof Error ? err.message : 'Сетевая ошибка',
              }
            : p,
        ),
      }));
    }
  },

  toggleSkill: (skillId) =>
    set((s) => ({
      skills: s.skills.map((sk) => (sk.id === skillId ? { ...sk, enabled: !sk.enabled } : sk)),
    })),

  addSkill: ({ title, category, triggerHint, contentMarkdown, source = 'custom' }) =>
    set((s) => {
      const slug =
        title
          .toLowerCase()
          .replace(/[^a-zа-я0-9]+/gi, '-')
          .replace(/^-+|-+$/g, '') || `skill-${Date.now()}`;
      const created: AgentSkill = {
        id: `skill-${Date.now()}`,
        slug,
        title: title.trim() || 'Новый навык',
        category,
        triggerHint: triggerHint.trim() || 'Применяется по контексту задачи',
        contentMarkdown,
        enabled: true,
        usageCount: 1,
        source,
        updatedAt: 'Сейчас',
      };
      return { skills: [created, ...s.skills] };
    }),

  updateSkill: (skillId, patch) =>
    set((s) => ({
      skills: s.skills.map((sk) =>
        sk.id === skillId ? { ...sk, ...patch, updatedAt: 'Сейчас' } : sk,
      ),
    })),

  deleteSkill: (skillId) =>
    set((s) => ({
      skills: s.skills.filter((sk) => sk.id !== skillId),
    })),

  learnSkillFromMessage: (messageId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === state.activeSessionId);
    const msg = session?.messages.find((m) => m.id === messageId);
    if (!msg || msg.skillLearned) return;

    const cleanSnippet = msg.content.replace(/\s+/g, ' ').trim();
    const title = msg.diff
      ? `Патч: ${msg.diff.filePath.split('/').pop()}`
      : msg.command
        ? `Команда: ${msg.command.command.slice(0, 32)}`
        : cleanSnippet.slice(0, 42) || 'Автообученный навык';

    const markdown = `---\nname: learned-${Date.now()}\ndescription: Извлечённый навык из сессии "${session?.title ?? 'Kova Studio'}"\n---\n${msg.content.slice(0, 600)}`;

    get().addSkill({
      title,
      category: 'Автоматизация',
      triggerHint: msg.diff?.summary ?? msg.command?.description ?? 'Решение из чата',
      contentMarkdown: markdown,
      source: 'learned',
    });

    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === s.activeSessionId
          ? {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === messageId ? { ...m, skillLearned: true } : m,
              ),
            }
          : sess,
      ),
    }));
  },

  updateMemoryDoc: (key, content) =>
    set((s) => ({
      memoryDocs: s.memoryDocs.map((doc) =>
        doc.key === key ? { ...doc, content, updatedAt: 'Сейчас' } : doc,
      ),
    })),

  appendMemoryFact: (fact) =>
    set((s) => ({
      memoryDocs: s.memoryDocs.map((doc) =>
        doc.key === 'memory'
          ? {
              ...doc,
              content: `${doc.content.trim()}\n- ${fact.trim()}`,
              updatedAt: 'Сейчас',
            }
          : doc,
      ),
    })),

  updateSubagentConfig: (patch) =>
    set((s) => ({
      subagentConfig: { ...s.subagentConfig, ...patch },
    })),

  launchSubagent: async ({ title, prompt, roleId, providerId }) => {
    const state = get();
    const role =
      state.roles.find((r) => r.id === (roleId ?? state.subagentConfig.defaultRoleId)) ??
      state.roles[0];
    const provider =
      state.freeProviders.find((p) => p.id === (providerId ?? state.subagentConfig.defaultProviderId)) ??
      state.freeProviders[0];
    const runId = `sub-${Date.now().toString(36)}`;
    const taskTitle = title?.trim() || prompt.trim().slice(0, 44) || 'Субагент';

    const initialRun: SubagentRun = {
      id: runId,
      title: taskTitle,
      prompt: prompt.trim(),
      roleId: role.id,
      roleName: role.name,
      providerId: provider.id,
      providerName: provider.name,
      modelName: provider.selectedModel,
      status: 'running',
      progressPct: 15,
      resultSummary: `Отправка реального запроса провайдеру ${provider.name}...`,
      startedAt: nowTime(),
    };

    const msgId = `msg-sub-${Date.now()}`;
    set((s) => ({
      subagentRuns: [initialRun, ...s.subagentRuns].slice(0, 16),
      sessions: s.sessions.map((sess) =>
        sess.id === s.activeSessionId
          ? {
              ...sess,
              messages: [
                ...sess.messages,
                {
                  id: msgId,
                  role: 'assistant',
                  mode: s.agentMode,
                  roleName: `Субагент · ${role.name}`,
                  providerLabel: `${provider.name} · ${provider.selectedModel}`,
                  timestamp: nowTime(),
                  content: `Субагент **${taskTitle}** отправлен на \`${provider.selectedModel}\`.`,
                  subagentRun: initialRun,
                },
              ],
            }
          : sess,
      ),
    }));

    try {
      const resp = await fetch('/api/providers/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: provider.selectedModel,
          temperature: role.recommendedTemp,
          messages: [
            { role: 'system', content: role.systemPrompt },
            { role: 'user', content: prompt.trim() },
          ],
        }),
      });
      const json = (await resp.json()) as { ok?: boolean; content?: string; error?: string };
      if (!resp.ok || !json.ok || !json.content) {
        throw new Error(json.error || `HTTP ${resp.status}`);
      }

      set((s) => ({
        subagentRuns: s.subagentRuns.map((r) =>
          r.id === runId ? { ...r, status: 'completed', progressPct: 100, resultSummary: json.content! } : r,
        ),
        sessions: s.sessions.map((sess) => ({
          ...sess,
          messages: sess.messages.map((m) =>
            m.subagentRun?.id === runId
              ? {
                  ...m,
                  subagentRun: { ...m.subagentRun, status: 'completed', progressPct: 100, resultSummary: json.content! },
                }
              : m,
          ),
        })),
      }));
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Провайдер недоступен';
      set((s) => ({
        subagentRuns: s.subagentRuns.map((r) =>
          r.id === runId ? { ...r, status: 'failed', progressPct: 100, resultSummary: `Ошибка: ${errText}` } : r,
        ),
        sessions: s.sessions.map((sess) => ({
          ...sess,
          messages: sess.messages.map((m) =>
            m.subagentRun?.id === runId
              ? {
                  ...m,
                  subagentRun: { ...m.subagentRun, status: 'failed', progressPct: 100, resultSummary: `Ошибка: ${errText}` },
                }
              : m,
          ),
        })),
      }));
    }
  },

  clearCompletedSubagents: () =>
    set((s) => ({
      subagentRuns: s.subagentRuns.filter((r) => r.status === 'running' || r.status === 'queued'),
    })),

  setActiveExecutionEnv: (env) =>
    set((s) => ({
      executionEnv: { ...s.executionEnv, activeEnv: env },
    })),

  updateExecutionEnv: (patch) =>
    set((s) => ({
      executionEnv: { ...s.executionEnv, ...patch },
    })),

  updateGateway: (platform, patch) =>
    set((s) => ({
      gateways: s.gateways.map((g) => (g.id === platform ? { ...g, ...patch } : g)),
    })),

  verifyTelegramGateway: async () => {
    const tg = get().gateways.find((g) => g.id === 'telegram');
    if (!tg) return;

    set((s) => ({
      gateways: s.gateways.map((g) =>
        g.id === 'telegram'
          ? { ...g, status: 'checking', statusMessage: 'Проверка токена через api.telegram.org...' }
          : g,
      ),
    }));

    try {
      const resp = await fetch('/api/gateway/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: tg.botToken }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        username?: string;
        firstName?: string;
        botId?: number;
      };

      if (!resp.ok || !data.ok) {
        set((s) => ({
          gateways: s.gateways.map((g) =>
            g.id === 'telegram'
              ? { ...g, status: 'error', statusMessage: data.error || `Ошибка проверки (HTTP ${resp.status})` }
              : g,
          ),
        }));
        return;
      }

      set((s) => ({
        gateways: s.gateways.map((g) =>
          g.id === 'telegram'
            ? {
                ...g,
                enabled: true,
                status: 'connected',
                statusMessage: `Бот подключён: @${data.username ?? data.firstName} (ID ${data.botId})`,
              }
            : g,
        ),
      }));
    } catch (err) {
      set((s) => ({
        gateways: s.gateways.map((g) =>
          g.id === 'telegram'
            ? {
                ...g,
                status: 'error',
                statusMessage: err instanceof Error ? err.message : 'Ошибка соединения с Telegram',
              }
            : g,
        ),
      }));
    }
  },
}));
