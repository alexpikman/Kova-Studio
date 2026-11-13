import { create } from 'zustand';
import { INITIAL_LOCAL_MODELS } from '../data/curatedModels';
import {
  INITIAL_DIRECTIVES,
  INITIAL_PERMISSIONS,
  INITIAL_PIPELINE_STAGES,
  INITIAL_ROLES,
} from '../data/rolesAndRules';
import {
  buildAgentReply,
  INITIAL_CHECKPOINTS,
  INITIAL_PROJECT_FILES,
  INITIAL_SESSIONS,
} from '../data/workspaceSeed';
import {
  INITIAL_GITHUB_SETTINGS,
  INITIAL_SSH_HOSTS,
  INITIAL_SSH_KEYS,
  INITIAL_SSH_SETTINGS,
} from '../data/sshGithubSeed';
import type {
  AgentMode,
  AppSettings,
  AppTab,
  ChatSession,
  Checkpoint,
  GitHubAccessSettings,
  GpuBackend,
  InferenceSettings,
  LocalModel,
  ModelCatalogItem,
  ModelDirective,
  ModelRole,
  PermissionPolicy,
  PermissionRule,
  PipelineStage,
  ProjectFile,
  ServerStatus,
  SshAlgorithm,
  SshGlobalSettings,
  SshHostEntry,
  SshKeyProfile,
  TrayNotification,
} from '../types/kova';

interface DownloadQueuePayload {
  repoId: string;
  name: string;
  quant: string;
  filename: string;
  sizeGb: number;
  minVramGb: number;
  minRamGb: number;
  license: string;
  sha256: string;
}

interface KovaStore {
  activeTab: AppTab;
  theme: 'dark' | 'light';
  settingsOpen: boolean;
  trayOpen: boolean;

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

  setActiveTab: (tab: AppTab) => void;
  toggleTheme: () => void;
  setSettingsOpen: (open: boolean) => void;
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
  runSinglePipelineStage: (stageId: string) => void;
  runFullPipeline: () => void;
  resetPipeline: () => void;

  selectFile: (path: string, switchToPreview?: boolean) => void;
  toggleFileContext: (path: string) => void;
  setIncludeProjectTree: (include: boolean) => void;
  setIncludeTerminalOutput: (include: boolean) => void;

  sendPrompt: (prompt: string) => void;
  applyDiff: (messageId: string) => void;
  rejectDiff: (messageId: string) => void;
  runCommand: (messageId: string, simulateFailure?: boolean) => void;
  skipCommand: (messageId: string) => void;
  diagnoseCommandError: (messageId: string) => void;
  rollbackToCheckpoint: (checkpointId: string) => void;

  selectLocalModel: (modelId: string) => void;
  deleteLocalModel: (modelId: string) => void;
  startDownload: (payload: DownloadQueuePayload) => void;
  startDownloadFromCatalog: (item: ModelCatalogItem, quant?: string) => void;
  togglePauseDownload: (modelId: string) => void;

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
  testSshHostConnection: (hostId: string) => void;
  updateSshSettings: (patch: Partial<SshGlobalSettings>) => void;
  updateGitHubAccess: (patch: Partial<GitHubAccessSettings>) => void;
  verifyGitHubAccess: () => Promise<void>;
}

const downloadTimers = new Map<string, ReturnType<typeof setInterval>>();

function nowTime(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function resolveBackendLabel(pref: GpuBackend): 'CUDA 12.4' | 'Vulkan 1.3' | 'CPU AVX2' {
  if (pref === 'cpu') return 'CPU AVX2';
  if (pref === 'vulkan') return 'Vulkan 1.3';
  return 'CUDA 12.4';
}

export const useKovaStore = create<KovaStore>((set, get) => ({
  activeTab: 'workstation',
  theme: 'dark',
  settingsOpen: false,
  trayOpen: false,

  sessions: INITIAL_SESSIONS,
  activeSessionId: INITIAL_SESSIONS[0].id,
  agentMode: 'act',
  centerPaneMode: 'chat',

  roles: INITIAL_ROLES,
  activeRoleId: INITIAL_ROLES[0].id,
  permissions: INITIAL_PERMISSIONS,
  directives: INITIAL_DIRECTIVES,
  pipelineStages: INITIAL_PIPELINE_STAGES,
  pipelineProjectName: 'Kova Desktop CRM',
  pipelineStack: 'Tauri 2.0 · Rust · React 19 · SQLite',
  pipelineRunning: false,

  files: INITIAL_PROJECT_FILES,
  selectedFilePath: INITIAL_PROJECT_FILES[0].path,
  includeProjectTree: true,
  includeTerminalOutput: true,
  terminalHistory: [
    'PS C:\\Projects\\kova-studio> .\\llama-server.exe --version',
    'version: b4812 (win-x64-cuda-12.4 / vulkan-1.3)',
    'HTTP server listening on http://127.0.0.1:8080',
  ],

  checkpoints: INITIAL_CHECKPOINTS,

  localModels: INITIAL_LOCAL_MODELS,
  activeModelId: INITIAL_LOCAL_MODELS[0].id,
  serverStatus: 'ready',
  tokensPerSec: 0,
  vramUsedGb: 5.8,
  ramUsedGb: 2.1,

  inferenceSettings: {
    gpuBackend: 'auto',
    detectedGpuName: 'NVIDIA GeForce RTX 4070 Laptop (8 GB)',
    detectedBackend: 'CUDA 12.4',
    temperature: 0.2,
    contextSize: 16384,
    gpuLayers: 99,
    maxVramGb: 8.0,
    maxRamGb: 32.0,
  },

  appSettings: {
    modelsDir: '%APPDATA%\\KovaStudio\\models\\',
    llamaServerPath: '%LOCALAPPDATA%\\KovaStudio\\bin\\llama-server.exe',
    autoCheckSha256: true,
    includeOpenFilesByDefault: true,
    includeTreeByDefault: true,
    cloudFallbackProvider: 'none',
    cloudFallbackKey: '',
  },

  notifications: [
    {
      id: 'notif-1',
      title: 'llama-server.exe готов к работе',
      detail: 'Модель Qwen2.5-Coder-7B-Instruct (Q4_K_M) загружена в CUDA 12.4.',
      timestamp: '00:05:10',
      read: false,
    },
  ],

  sshKeys: INITIAL_SSH_KEYS,
  activeSshKeyId: INITIAL_SSH_KEYS[0].id,
  sshHosts: INITIAL_SSH_HOSTS,
  sshSettings: INITIAL_SSH_SETTINGS,
  githubAccess: INITIAL_GITHUB_SETTINGS,

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return { theme: next };
    }),

  setSettingsOpen: (open) => set({ settingsOpen: open }),
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

  setPipelineConfig: (name, stack) =>
    set({ pipelineProjectName: name, pipelineStack: stack }),

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

  runSinglePipelineStage: (stageId) => {
    const stage = get().pipelineStages.find((s) => s.id === stageId);
    if (!stage) return;
    const role = get().roles.find((r) => r.id === stage.assignedRoleId);
    if (role) {
      get().setActiveRole(role.id, false);
    }

    set((state) => ({
      serverStatus: 'generating',
      tokensPerSec: 46.2,
      pipelineStages: state.pipelineStages.map((st) =>
        st.id === stageId ? { ...st, status: 'running' } : st,
      ),
    }));

    setTimeout(() => {
      const currProject = get().pipelineProjectName || 'Kova Project';
      const currStack = get().pipelineStack || 'Tauri 2.0 + Rust';
      set((state) => ({
        serverStatus: 'ready',
        tokensPerSec: 0,
        pipelineStages: state.pipelineStages.map((st) =>
          st.id === stageId
            ? {
                ...st,
                status: 'done',
                resultNote: `Выполнено ролью «${role?.name ?? 'Агент'}» для ${currProject} (${currStack}) → ${st.outputArtifact}`,
              }
            : st,
        ),
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: `Этап «${stage.title}» завершён`,
            detail: `Роль: ${role?.name ?? 'Агент'} · Артефакт: ${stage.outputArtifact}`,
            timestamp: nowTime(),
            read: false,
          },
          ...state.notifications,
        ],
      }));
    }, 650);
  },

  runFullPipeline: () => {
    if (get().pipelineRunning) return;
    get().resetPipeline();
    set({ pipelineRunning: true });
    const stageIds = get().pipelineStages.map((s) => s.id);

    stageIds.forEach((id, index) => {
      setTimeout(() => {
        get().runSinglePipelineStage(id);
        if (index === stageIds.length - 1) {
          setTimeout(() => {
            set({ pipelineRunning: false });
          }, 700);
        }
      }, index * 780);
    });
  },

  selectFile: (path, switchToPreview = false) =>
    set((state) => ({
      selectedFilePath: path,
      centerPaneMode: switchToPreview ? 'file' : state.centerPaneMode,
    })),

  toggleFileContext: (path) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.path === path ? { ...f, inContext: !f.inContext } : f,
      ),
    })),

  setIncludeProjectTree: (include) => set({ includeProjectTree: include }),
  setIncludeTerminalOutput: (include) => set({ includeTerminalOutput: include }),

  sendPrompt: (prompt) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const state = get();
    if (state.serverStatus === 'stopped') {
      set({ serverStatus: 'ready' });
    }

    const sessionId = state.activeSessionId;
    const mode = state.agentMode;
    const activeRole = state.roles.find((r) => r.id === state.activeRoleId);
    const userMsgId = `msg-u-${Date.now()}`;
    const assistantMsgId = `msg-a-${Date.now() + 1}`;

    const replyTemplate = buildAgentReply(trimmed, mode, state.files, {
      activeRole,
      permissions: state.permissions,
      directives: state.directives,
    });
    const fullText = replyTemplate.content;

    set((s) => ({
      centerPaneMode: 'chat',
      serverStatus: 'generating',
      tokensPerSec: s.inferenceSettings.gpuBackend === 'cpu' ? 11.4 : 44.6,
      sessions: s.sessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const isFirst = sess.messages.length === 0;
        return {
          ...sess,
          title: isFirst ? trimmed.slice(0, 44) : sess.title,
          updatedAt: 'Сейчас',
          messages: [
            ...sess.messages,
            {
              id: userMsgId,
              role: 'user',
              mode,
              timestamp: nowTime(),
              content: trimmed,
            },
            {
              ...replyTemplate,
              id: assistantMsgId,
              timestamp: nowTime(),
              content: '',
              diff: undefined,
              command: undefined,
              isStreaming: true,
            },
          ],
        };
      }),
    }));

    // Stream tokens progressively into Zustand store
    const words = fullText.split(' ');
    let cursor = 0;
    const streamTimer = setInterval(() => {
      cursor = Math.min(words.length, cursor + 4);
      const chunk = words.slice(0, cursor).join(' ');
      const done = cursor >= words.length;

      set((s) => ({
        serverStatus: done ? 'ready' : 'generating',
        tokensPerSec: done
          ? 0
          : Number(((s.inferenceSettings.gpuBackend === 'cpu' ? 11.2 : 43.5) + Math.random() * 4.5).toFixed(1)),
        sessions: s.sessions.map((sess) => {
          if (sess.id !== sessionId) return sess;
          return {
            ...sess,
            messages: sess.messages.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: chunk,
                    isStreaming: !done,
                    diff: done ? replyTemplate.diff : undefined,
                    command: done ? replyTemplate.command : undefined,
                  }
                : m,
            ),
          };
        }),
      }));

      if (done) {
        clearInterval(streamTimer);
      }
    }, 45);
  },

  applyDiff: (messageId) => {
    const state = get();
    const activeSession = state.sessions.find((s) => s.id === state.activeSessionId);
    const targetMsg = activeSession?.messages.find((m) => m.id === messageId);
    const diff = targetMsg?.diff;
    if (!diff || diff.status !== 'pending') return;

    // Create automatic checkpoint before writing files
    const snapshot: Record<string, string> = {};
    state.files.forEach((f) => {
      snapshot[f.path] = f.content;
    });

    const cpId = `cp-${String(state.checkpoints.length + 1).padStart(3, '0')}`;
    const newCheckpoint: Checkpoint = {
      id: cpId,
      label: `Перед правкой ${diff.filePath.split('/').pop()}`,
      timestamp: nowTime(),
      actionSummary: diff.summary,
      filesSnapshot: snapshot,
    };

    set((s) => ({
      checkpoints: [newCheckpoint, ...s.checkpoints],
      files: s.files.map((f) =>
        f.path === diff.filePath
          ? {
              ...f,
              content: diff.newContent,
              tokensEstimate: Math.round(diff.newContent.length / 3.8),
            }
          : f,
      ),
      sessions: s.sessions.map((sess) =>
        sess.id === s.activeSessionId
          ? {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === messageId && m.diff
                  ? {
                      ...m,
                      checkpointId: cpId,
                      diff: { ...m.diff, status: 'applied', checkpointId: cpId },
                    }
                  : m,
              ),
            }
          : sess,
      ),
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: `Дифф применён (${diff.filePath.split('/').pop()})`,
          detail: `Создан Checkpoint ${cpId} для безопасного отката.`,
          timestamp: nowTime(),
          read: false,
        },
        ...s.notifications,
      ],
    }));
  },

  rejectDiff: (messageId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === s.activeSessionId
          ? {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === messageId && m.diff
                  ? { ...m, diff: { ...m.diff, status: 'rejected' } }
                  : m,
              ),
            }
          : sess,
      ),
    }));
  },

  runCommand: (messageId, simulateFailure = false) => {
    const state = get();
    const sessionId = state.activeSessionId;

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
                        status: 'running',
                        output: [`PS ${m.command.cwd}> ${m.command.command}`],
                      },
                    }
                  : m,
              ),
            }
          : sess,
      ),
    }));

    setTimeout(() => {
      const currentState = get();
      const targetMsg = currentState.sessions
        .find((s) => s.id === sessionId)
        ?.messages.find((m) => m.id === messageId);
      const cmd = targetMsg?.command;
      if (!cmd) return;

      const bridgeFile = currentState.files.find((f) => f.path.endsWith('llama_bridge.rs'));
      const missingImportBug = simulateFailure || (bridgeFile && !bridgeFile.content.includes('has_nvidia_cuda') && cmd.command.includes('cargo check'));

      const lines = missingImportBug
        ? [
            `PS ${cmd.cwd}> ${cmd.command}`,
            '    Checking kova-studio v0.1.0 (C:\\Projects\\kova-studio\\src-tauri)',
            'error[E0425]: cannot find function `has_nvidia_cuda` or `--flash-attn` validation',
            '  --> src\\llama_bridge.rs:26:12',
            '   |',
            '26 |     let (backend, ngl) = detect_gpu_layers(&gpu_pref);',
            '   |                          ^^^^^^^^^^^^^^^^^ GPU auto-probe not applied yet',
            'error: could not compile `kova-studio` (lib) due to 1 previous error',
          ]
        : [
            `PS ${cmd.cwd}> ${cmd.command}`,
            '    Checking kova-studio v0.1.0 (C:\\Projects\\kova-studio\\src-tauri)',
            '    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.42s',
            'Exit code: 0',
          ];

      set((s) => ({
        terminalHistory: [...s.terminalHistory.slice(-8), ...lines],
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
                          status: missingImportBug ? 'failed' : 'success',
                          exitCode: missingImportBug ? 101 : 0,
                          output: lines,
                          canDiagnose: Boolean(missingImportBug),
                        },
                      }
                    : m,
                ),
              }
            : sess,
        ),
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: missingImportBug ? 'Ошибка выполнения команды' : 'Команда завершена успешно',
            detail: cmd.command,
            timestamp: nowTime(),
            read: false,
          },
          ...s.notifications,
        ],
      }));
    }, 650);
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

    get().sendPrompt(
      `Проанализируй ошибку компиляции (${targetMsg.command.command}) и предложи исправление в llama_bridge.rs`,
    );
  },

  rollbackToCheckpoint: (checkpointId) => {
    const state = get();
    const cp = state.checkpoints.find((c) => c.id === checkpointId);
    if (!cp) return;

    set((s) => ({
      files: s.files.map((f) => {
        const restored = cp.filesSnapshot[f.path];
        if (restored === undefined) return f;
        return {
          ...f,
          content: restored,
          tokensEstimate: Math.round(restored.length / 3.8),
        };
      }),
      sessions: s.sessions.map((sess) =>
        sess.id === s.activeSessionId
          ? {
              ...sess,
              messages: [
                ...sess.messages,
                {
                  id: `msg-rb-${Date.now()}`,
                  role: 'assistant',
                  mode: s.agentMode,
                  timestamp: nowTime(),
                  content: `Выполнен откат файловой системы к Checkpoint **${cp.id}** (*${cp.label}* от ${cp.timestamp}). Все изменения после этой точки отменены.`,
                  checkpointId: cp.id,
                },
              ],
            }
          : sess,
      ),
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: `Откат к ${cp.id}`,
          detail: cp.label,
          timestamp: nowTime(),
          read: false,
        },
        ...s.notifications,
      ],
    }));
  },

  selectLocalModel: (modelId) => {
    const model = get().localModels.find((m) => m.id === modelId);
    if (!model || model.status !== 'ready') return;

    set({
      activeModelId: modelId,
      serverStatus: 'loading',
      tokensPerSec: 0,
    });

    setTimeout(() => {
      const current = get();
      const gpuLim = current.inferenceSettings.maxVramGb;
      const fitsVram = model.minVramGb <= gpuLim;
      const usedVram = fitsVram ? model.minVramGb : Number((gpuLim * 0.92).toFixed(1));
      const spillRam = fitsVram ? 1.8 : Number((model.minVramGb - gpuLim + 2.4).toFixed(1));

      set({
        serverStatus: 'ready',
        vramUsedGb: usedVram,
        ramUsedGb: spillRam,
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: `Загружена модель ${model.name}`,
            detail: `Квантизация ${model.quant} · ${usedVram} GB VRAM`,
            timestamp: nowTime(),
            read: false,
          },
          ...current.notifications,
        ],
      });
    }, 550);
  },

  deleteLocalModel: (modelId) => {
    const existingTimer = downloadTimers.get(modelId);
    if (existingTimer) {
      clearInterval(existingTimer);
      downloadTimers.delete(modelId);
    }
    set((s) => {
      const remaining = s.localModels.filter((m) => m.id !== modelId);
      const nextActive =
        s.activeModelId === modelId
          ? remaining.find((m) => m.status === 'ready')?.id ?? ''
          : s.activeModelId;
      return {
        localModels: remaining,
        activeModelId: nextActive,
      };
    });
  },

  startDownload: (payload) => {
    const existing = get().localModels.find(
      (m) => m.repoId === payload.repoId && m.quant === payload.quant,
    );
    if (existing) {
      if (existing.status === 'paused') {
        get().togglePauseDownload(existing.id);
      }
      return;
    }

    const totalBytes = Math.max(1024 * 1024 * 500, Math.round(payload.sizeGb * 1024 * 1024 * 1024));
    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const dir = get().appSettings.modelsDir.replace(/\\$/, '');

    const newModel: LocalModel = {
      id,
      repoId: payload.repoId,
      name: payload.name,
      quant: payload.quant,
      filename: payload.filename,
      sizeGb: payload.sizeGb,
      minVramGb: payload.minVramGb,
      minRamGb: payload.minRamGb,
      license: payload.license,
      sha256: payload.sha256,
      localPath: `${dir}\\${payload.filename}`,
      status: 'downloading',
      progressPct: 2,
      speedMbps: 68.4,
      downloadedBytes: Math.round(totalBytes * 0.02),
      totalBytes,
    };

    set((s) => ({
      localModels: [newModel, ...s.localModels],
    }));

    const startIntervalFor = (targetId: string) => {
      const prev = downloadTimers.get(targetId);
      if (prev) clearInterval(prev);

      const timer = setInterval(() => {
        const curr = get().localModels.find((m) => m.id === targetId);
        if (!curr || curr.status !== 'downloading') {
          clearInterval(timer);
          downloadTimers.delete(targetId);
          return;
        }

        const nextPct = Math.min(100, curr.progressPct + 9);
        const speed = Number((58 + Math.random() * 24).toFixed(1));

        if (nextPct >= 100) {
          clearInterval(timer);
          downloadTimers.delete(targetId);

          set((s) => ({
            localModels: s.localModels.map((m) =>
              m.id === targetId
                ? {
                    ...m,
                    status: s.appSettings.autoCheckSha256 ? 'verifying' : 'ready',
                    progressPct: 100,
                    speedMbps: 0,
                    downloadedBytes: m.totalBytes,
                  }
                : m,
            ),
          }));

          if (get().appSettings.autoCheckSha256) {
            setTimeout(() => {
              set((s) => ({
                localModels: s.localModels.map((m) =>
                  m.id === targetId ? { ...m, status: 'ready' } : m,
                ),
                notifications: [
                  {
                    id: `notif-${Date.now()}`,
                    title: `Модель ${curr.name} готова`,
                    detail: `SHA256 подтверждён · ${curr.quant} (${curr.sizeGb} GB)`,
                    timestamp: nowTime(),
                    read: false,
                  },
                  ...s.notifications,
                ],
              }));
            }, 900);
          }
        } else {
          set((s) => ({
            localModels: s.localModels.map((m) =>
              m.id === targetId
                ? {
                    ...m,
                    progressPct: nextPct,
                    speedMbps: speed,
                    downloadedBytes: Math.round((m.totalBytes * nextPct) / 100),
                  }
                : m,
            ),
          }));
        }
      }, 320);

      downloadTimers.set(targetId, timer);
    };

    startIntervalFor(id);
  },

  startDownloadFromCatalog: (item, quant) => {
    const selectedQuant = quant || item.defaultQuant || 'Q4_K_M';
    const variant = item.files?.find((f) => f.quant === selectedQuant);
    const filename =
      variant?.filename ??
      `${item.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}-${selectedQuant.toLowerCase()}.gguf`;

    get().startDownload({
      repoId: item.repoId,
      name: item.name,
      quant: selectedQuant,
      filename,
      sizeGb: variant?.sizeGb ?? item.sizeGb,
      minVramGb: item.minVramGb,
      minRamGb: item.minRamGb,
      license: item.license,
      sha256:
        variant?.sha256 ??
        item.sha256 ??
        '7c8f4e2a9b1d0c3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e',
    });
  },

  togglePauseDownload: (modelId) => {
    const target = get().localModels.find((m) => m.id === modelId);
    if (!target) return;

    if (target.status === 'downloading') {
      const t = downloadTimers.get(modelId);
      if (t) {
        clearInterval(t);
        downloadTimers.delete(modelId);
      }
      set((s) => ({
        localModels: s.localModels.map((m) =>
          m.id === modelId ? { ...m, status: 'paused', speedMbps: 0 } : m,
        ),
      }));
    } else if (target.status === 'paused') {
      set((s) => ({
        localModels: s.localModels.map((m) =>
          m.id === modelId ? { ...m, status: 'downloading', speedMbps: 64.2 } : m,
        ),
      }));
      const timer = setInterval(() => {
        const curr = get().localModels.find((m) => m.id === modelId);
        if (!curr || curr.status !== 'downloading') {
          clearInterval(timer);
          downloadTimers.delete(modelId);
          return;
        }
        const nextPct = Math.min(100, curr.progressPct + 10);
        if (nextPct >= 100) {
          clearInterval(timer);
          downloadTimers.delete(modelId);
          set((s) => ({
            localModels: s.localModels.map((m) =>
              m.id === modelId
                ? {
                    ...m,
                    status: 'ready',
                    progressPct: 100,
                    speedMbps: 0,
                    downloadedBytes: m.totalBytes,
                  }
                : m,
            ),
          }));
        } else {
          set((s) => ({
            localModels: s.localModels.map((m) =>
              m.id === modelId
                ? {
                    ...m,
                    progressPct: nextPct,
                    speedMbps: 67.5,
                    downloadedBytes: Math.round((m.totalBytes * nextPct) / 100),
                  }
                : m,
            ),
          }));
        }
      }, 320);
      downloadTimers.set(modelId, timer);
    }
  },

  updateInferenceSettings: (patch) =>
    set((s) => {
      const next = { ...s.inferenceSettings, ...patch };
      if (patch.gpuBackend) {
        next.detectedBackend = resolveBackendLabel(patch.gpuBackend);
      }
      return { inferenceSettings: next };
    }),

  updateAppSettings: (patch) =>
    set((s) => ({
      appSettings: { ...s.appSettings, ...patch },
    })),

  toggleServerPower: () =>
    set((s) => ({
      serverStatus: s.serverStatus === 'stopped' ? 'ready' : 'stopped',
      tokensPerSec: 0,
      vramUsedGb: s.serverStatus === 'stopped' ? 5.8 : 0,
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
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'custom';
      const prefix = algorithm === 'rsa-4096' ? 'id_rsa' : algorithm === 'ecdsa' ? 'id_ecdsa' : 'id_ed25519';
      const randBytes = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      const pubPrefix =
        algorithm === 'rsa-4096'
          ? 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC'
          : algorithm === 'ecdsa'
            ? 'ecdsa-sha2-nistp521 AAAAE2VjZHNhLXNoYTIt'
            : 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI';

      const newKey: SshKeyProfile = {
        id: `ssh-key-${Date.now()}`,
        name: name.trim() || `Ключ ${algorithm.toUpperCase()}`,
        algorithm,
        comment: comment.trim() || s.githubAccess.gitUserEmail,
        privateKeyPath: `${s.sshSettings.defaultKeyDir.replace(/\\$/, '')}\\${prefix}_${slug}`,
        publicKey: `${pubPrefix}${randBytes}KovaStudioGeneratedKey ${comment.trim() || s.githubAccess.gitUserEmail}`,
        fingerprint: `SHA256:${randBytes.toUpperCase()}vL9mK2pQ`,
        hasPassphrase,
        addedToAgent: s.sshSettings.openSshAgentAutoStart,
        createdAt: new Date().toISOString().slice(0, 10),
      };

      return {
        sshKeys: [newKey, ...s.sshKeys],
        activeSshKeyId: newKey.id,
      };
    }),

  toggleSshKeyInAgent: (keyId) =>
    set((s) => ({
      sshKeys: s.sshKeys.map((k) =>
        k.id === keyId ? { ...k, addedToAgent: !k.addedToAgent } : k,
      ),
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
      sshHosts: [
        ...s.sshHosts,
        {
          ...host,
          id: `host-${Date.now()}`,
          status: 'untested',
        },
      ],
    })),

  updateSshHost: (hostId, patch) =>
    set((s) => ({
      sshHosts: s.sshHosts.map((h) => (h.id === hostId ? { ...h, ...patch } : h)),
    })),

  deleteSshHost: (hostId) =>
    set((s) => ({
      sshHosts: s.sshHosts.filter((h) => h.id !== hostId),
    })),

  testSshHostConnection: (hostId) => {
    const target = get().sshHosts.find((h) => h.id === hostId);
    if (!target) return;

    const activeKey = get().sshKeys.find((k) => k.privateKeyPath === target.identityFile);
    const ok = Boolean(target.hostName.trim()) && target.port > 0 && target.port <= 65535;
    set((s) => ({
      sshHosts: s.sshHosts.map((h) =>
        h.id === hostId
          ? {
              ...h,
              status: ok ? 'connected' : 'error',
              lastChecked: ok
                ? `Рукопожатие OK (${activeKey ? activeKey.algorithm : 'ed25519'}) · ${nowTime()}`
                : 'Ошибка параметров хоста',
            }
          : h,
      ),
    }));
  },

  updateSshSettings: (patch) =>
    set((s) => ({
      sshSettings: { ...s.sshSettings, ...patch },
    })),

  updateGitHubAccess: (patch) =>
    set((s) => ({
      githubAccess: { ...s.githubAccess, ...patch },
    })),

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
        repo?: {
          fullName: string;
          isPrivate: boolean;
          defaultBranch: string;
          stars: number;
        };
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
}));
