import type {
  AgentMemoryDoc,
  AgentSkill,
  ExecutionEnvConfig,
  FreeProviderProfile,
  GatewayChannelConfig,
  SubagentConfig,
} from '../types/kova';

export const INITIAL_FREE_PROVIDERS: FreeProviderProfile[] = [
  {
    id: 'prov-llama-cpp',
    kind: 'llama-cpp',
    name: 'Локальный llama-server.exe',
    badgeText: '100% локально · Без лимитов',
    baseUrl: 'http://127.0.0.1:8080/v1',
    apiKey: '',
    requiresKey: false,
    isLocal: true,
    selectedModel: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M',
    availableModels: [
      'Qwen2.5-Coder-7B-Instruct-Q4_K_M',
      'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M',
      'Phi-4-mini-instruct-Q5_K_M',
    ],
    description:
      'Встроенный sidecar llama.cpp на вашем ПК. Полностью бесплатный офлайн-инференс на CUDA, Vulkan или CPU без отправки кода.',
    status: 'connected',
    lastCheckMessage: 'Sidecar готов к запуску на 127.0.0.1:8080',
  },
  {
    id: 'prov-openrouter-free',
    kind: 'openrouter-free',
    name: 'OpenRouter (только :free модели)',
    badgeText: '$0.00 · Без списаний',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    requiresKey: true,
    isLocal: false,
    selectedModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
    availableModels: [
      'qwen/qwen-2.5-coder-32b-instruct:free',
      'deepseek/deepseek-chat-v3-0324:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-3-27b-it:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
    ],
    description:
      'Автоматический фильтр строго по бесплатным моделям (:free). Поддерживает крупные облачные модели 32B–70B с нулевой стоимостью токена.',
    status: 'idle',
    lastCheckMessage: 'Нажмите «Загрузить :free модели» для живого списка',
  },
  {
    id: 'prov-ollama',
    kind: 'ollama',
    name: 'Ollama (локальный сервер)',
    badgeText: 'Локально · OpenAI API',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: '',
    requiresKey: false,
    isLocal: true,
    selectedModel: 'qwen2.5-coder:7b',
    availableModels: ['qwen2.5-coder:7b', 'deepseek-r1:8b', 'llama3.2:latest'],
    description:
      'Прямое подключение к локальному демону Ollama без ограничений контекста или токенов.',
    status: 'idle',
  },
  {
    id: 'prov-lmstudio',
    kind: 'lmstudio',
    name: 'LM Studio (локальный сервер)',
    badgeText: 'Локально · Port 1234',
    baseUrl: 'http://127.0.0.1:1234/v1',
    apiKey: '',
    requiresKey: false,
    isLocal: true,
    selectedModel: 'qwen2.5-coder-7b-instruct',
    availableModels: ['qwen2.5-coder-7b-instruct', 'codestral-22b-v0.1'],
    description:
      'Локальный OpenAI-compatible сервер LM Studio на порту 1234.',
    status: 'idle',
  },
  {
    id: 'prov-groq-free',
    kind: 'groq-free',
    name: 'Groq Free Tier',
    badgeText: 'Бесплатный LPU-кластер',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: '',
    requiresKey: true,
    isLocal: false,
    selectedModel: 'llama-3.3-70b-versatile',
    availableModels: ['llama-3.3-70b-versatile', 'qwen-qwq-32b', 'gemma2-9b-it'],
    description:
      'Высокоскоростной бесплатный тариф Groq с бесплатным API-ключом из console.groq.com.',
    status: 'idle',
  },
  {
    id: 'prov-custom',
    kind: 'custom',
    name: 'Свой OpenAI-compatible сервер',
    badgeText: 'Любой URL / vLLM / LocalAI',
    baseUrl: 'http://127.0.0.1:8000/v1',
    apiKey: '',
    requiresKey: false,
    isLocal: true,
    selectedModel: 'custom-model',
    availableModels: ['custom-model'],
    description:
      'Подключение к любому вашему серверу (vLLM, TabbyAPI, LocalAI, VPS) без ограничений.',
    status: 'idle',
  },
];

export const INITIAL_SKILLS: AgentSkill[] = [
  {
    id: 'skill-http-range-gguf',
    slug: 'gguf-http-range-resume',
    title: 'Докачка GGUF по HTTP 206 + SHA256',
    category: 'Разработка',
    triggerHint: 'При работе с загрузкой весов, .part файлами или LFS-хэшами',
    contentMarkdown: `---
name: gguf-http-range-resume
description: Надёжная докачка больших GGUF-файлов через reqwest без падения на разрыве сети
---
1. Проверять размер существующего \`.part\` файла и отправлять заголовок \`Range: bytes=<offset>-\`.
2. Обрабатывать HTTP 206 Partial Content и HTTP 200 (если сервер сбросил смещение — перезаписать файл с нуля).
3. После завершения потока вычислять SHA256 через потоковый хешер перед переименованием \`.part\` -> \`.gguf\`.`,
    enabled: true,
    usageCount: 14,
    source: 'builtin',
    updatedAt: 'Сегодня',
  },
  {
    id: 'skill-windows-gpu-probe',
    slug: 'windows-gpu-probe-no-freeze',
    title: 'Неблокирующий авто-детект GPU (CUDA / Vulkan)',
    category: 'DevOps',
    triggerHint: 'При запуске llama-server.exe или диагностике VRAM на Windows',
    contentMarkdown: `---
name: windows-gpu-probe-no-freeze
description: Безопасный выбор бэкенда GPU без зависания UI WebView2
---
1. Запускать \`nvidia-smi\` только внутри \`tokio::task::spawn_blocking\` с флагом \`CREATE_NO_WINDOW\`.
2. При отсутствии NVIDIA автоматически переключаться на \`--gpu-layers\` через Vulkan 1.3 или CPU AVX2.`,
    enabled: true,
    usageCount: 9,
    source: 'learned',
    updatedAt: 'Вчера',
  },
  {
    id: 'skill-tauri-cloud-ci',
    slug: 'tauri-windows-cloud-release',
    title: 'Облачная сборка Tauri 2.0 без локального MSVC',
    category: 'DevOps',
    triggerHint: 'При ошибке MSVC 8012 или обновлении GitHub Actions',
    contentMarkdown: `---
name: tauri-windows-cloud-release
description: Сборка .exe и .msi в GitHub Actions и установка на Windows без Build Tools
---
1. Использовать \`npm install --legacy-peer-deps\` на \`windows-latest\` без обязательного \`package-lock.json\`.
2. Скачивать sidecar \`llama-server.exe\` и публиковать артефакты через \`tauri-apps/tauri-action\`.`,
    enabled: true,
    usageCount: 6,
    source: 'learned',
    updatedAt: 'Вчера',
  },
  {
    id: 'skill-sqlite-checkpoint',
    slug: 'atomic-sqlite-checkpoint',
    title: 'Атомарные Checkpoints перед правкой файлов',
    category: 'Автоматизация',
    triggerHint: 'Перед любым replace_in_file или записью в режиме Act',
    contentMarkdown: `---
name: atomic-sqlite-checkpoint
description: Снапшот исходников до применения диффа с мгновенным откатом
---
1. Снимать копию всех изменяемых файлов в локальный снапшот перед применением патча.
2. Помечать сообщение в чате идентификатором Checkpoint для отката в 1 клик.`,
    enabled: true,
    usageCount: 21,
    source: 'builtin',
    updatedAt: 'Сегодня',
  },
];

export const INITIAL_MEMORY_DOCS: AgentMemoryDoc[] = [
  {
    key: 'soul',
    filename: 'SOUL.md',
    title: 'Характер и стиль агента',
    description: 'Вдохновлено OpenKova SOUL.md: краткость, точность и фокус на рабочем коде без воды.',
    content: `Ты — автономный инженерный агент ONE CORE AI (Cline + OpenKova).
Отвечай прямо, по существу, без лишних вводных фраз.
Перед правкой кода в режиме Act всегда сохраняй Checkpoint и объясняй проверяемый результат.
Предлагай сохранять удачные решения в библиотеку навыков SKILL.md.`,
    updatedAt: 'Сегодня',
  },
  {
    key: 'memory',
    filename: 'MEMORY.md',
    title: 'Накопленная память проекта',
    description: 'Устойчивые факты о репозитории, архитектуре и решениях, доступные во всех сессиях.',
    content: `- Репозиторий: alexpikman/Kova-Studio (Windows 10/11, Tauri 2.0, React 19, Vite, Express, llama.cpp).
- На ПК пользователя избегать локальной установки MSVC Build Tools (ошибка 8012) — сборка .exe/.msi идёт через GitHub Actions.
- Предпочтение: 100% бесплатные провайдеры (локальный llama-server.exe, Ollama, OpenRouter :free).
- В интерфейсе поддерживаются 3 стиля (Cline / VS Code, Windows 11 Mica, Терминал Obsidian).`,
    updatedAt: 'Сегодня',
  },
  {
    key: 'user',
    filename: 'USER.md',
    title: 'Профиль и предпочтения пользователя',
    description: 'Стек, язык общения, привычные инструменты и правила безопасности.',
    content: `- Язык интерфейса и ответов: русский.
- ОС: Windows 10/11 (PowerShell 7 / Windows Terminal).
- Принцип работы: бесплатно и без искусственных ограничений, полный контроль над областями чата.`,
    updatedAt: 'Сегодня',
  },
];

export const INITIAL_SUBAGENT_CONFIG: SubagentConfig = {
  enabled: true,
  maxParallel: 4,
  maxIterations: 12,
  defaultRoleId: 'role-reviewer',
  defaultProviderId: 'prov-llama-cpp',
  autoSummarizeResult: true,
};

export const INITIAL_EXECUTION_ENV: ExecutionEnvConfig = {
  activeEnv: 'local',
  localShell: 'powershell',
  localWorkdir: 'C:\\Projects\\kova-studio',
  sshHostId: 'host-github',
  dockerImage: 'rust:1.83-slim',
  dockerWorkdir: '/workspace',
  dockerMountWorkspace: true,
  dockerNetworkMode: 'bridge',
  requireApprovalBeforeExec: true,
};

export const INITIAL_GATEWAYS: GatewayChannelConfig[] = [
  {
    id: 'telegram',
    name: 'Telegram Bot Gateway',
    enabled: false,
    botToken: '',
    allowedChatIds: '',
    prefixCommand: '/kova',
    autoReplyVoiceNotes: true,
    requireApprovalForWrite: true,
    status: 'idle',
    statusMessage: 'Укажите токен от @BotFather для проверки и запуска шлюза',
  },
  {
    id: 'discord',
    name: 'Discord Bot Gateway',
    enabled: false,
    botToken: '',
    allowedChatIds: '',
    prefixCommand: '!kova',
    autoReplyVoiceNotes: false,
    requireApprovalForWrite: true,
    status: 'idle',
    statusMessage: 'Подключение по Bot Token из Discord Developer Portal',
  },
  {
    id: 'slack',
    name: 'Slack Socket Mode',
    enabled: false,
    botToken: '',
    allowedChatIds: '',
    prefixCommand: '/kova',
    autoReplyVoiceNotes: false,
    requireApprovalForWrite: true,
    status: 'idle',
    statusMessage: 'Поддержка Socket Mode App Token (xapp-...) и Bot Token (xoxb-...)',
  },
];

export interface SlashCommandDef {
  command: string;
  syntax: string;
  description: string;
}

export const OPENKOVA_SLASH_COMMANDS: SlashCommandDef[] = [
  {
    command: '/web',
    syntax: '/web <поисковый запрос>',
    description: 'Найти и прочитать публичные веб-страницы без выполнения действий на сайтах',
  },
  {
    command: '/browse',
    syntax: '/browse <HTTPS-адрес>',
    description: 'Прочитать текст публичной HTTPS-страницы',
  },
  {
    command: '/run',
    syntax: '/run <команда терминала>',
    description: 'Реально выполнить команду в папке активного проекта',
  },
  {
    command: '/git',
    syntax: '/git status | diff | log | fetch',
    description: 'Выполнить реальную команду git в папке проекта',
  },
  {
    command: '/search',
    syntax: '/search <строка>',
    description: 'Поиск по исходному коду в папке активного проекта',
  },
  {
    command: '/undo',
    syntax: '/undo',
    description: 'Откатить последнее изменение файла агентом на диске',
  },
  {
    command: '/skill',
    syntax: '/skill <название или задача>',
    description: 'Найти, подключить или создать навык SKILL.md',
  },
  {
    command: '/memory',
    syntax: '/memory <факт для запоминания>',
    description: 'Сохранить факт в долговременную память MEMORY.md',
  },
  {
    command: '/subagent',
    syntax: '/subagent <задача воркеру>',
    description: 'Запустить параллельного субагента через реальный API провайдера',
  },
  {
    command: '/env',
    syntax: '/env local | ssh | docker',
    description: 'Переключить среду выполнения команд терминала',
  },
  {
    command: '/provider',
    syntax: '/provider llama | openrouter | ollama',
    description: 'Переключить бесплатный провайдер модели без ограничений',
  },
];

export function buildGatewayStartScript(
  gateways: GatewayChannelConfig[],
  activeProvider: FreeProviderProfile | undefined,
  envConfig: ExecutionEnvConfig,
): string {
  const tg = gateways.find((g) => g.id === 'telegram');
  const dc = gateways.find((g) => g.id === 'discord');
  const sl = gateways.find((g) => g.id === 'slack');

  return `# ONE CORE AI — Запуск бесплатного шлюза мессенджеров (OpenKova Gateway Bridge)
$ErrorActionPreference = "Stop"

$env:KOVA_PROVIDER_URL = "${activeProvider?.baseUrl ?? 'http://127.0.0.1:8080/v1'}"
$env:KOVA_PROVIDER_MODEL = "${activeProvider?.selectedModel ?? 'Qwen2.5-Coder-7B-Instruct-Q4_K_M'}"
$env:KOVA_EXEC_ENV = "${envConfig.activeEnv}"
${tg?.botToken ? `$env:TELEGRAM_BOT_TOKEN = "${tg.botToken}"` : '# $env:TELEGRAM_BOT_TOKEN = "123456:ABC..."'}
${tg?.allowedChatIds ? `$env:TELEGRAM_ALLOWED_USERS = "${tg.allowedChatIds}"` : '# $env:TELEGRAM_ALLOWED_USERS = "123456789"'}
${dc?.botToken ? `$env:DISCORD_BOT_TOKEN = "${dc.botToken}"` : '# $env:DISCORD_BOT_TOKEN = "..."'}
${sl?.botToken ? `$env:SLACK_BOT_TOKEN = "${sl.botToken}"` : '# $env:SLACK_BOT_TOKEN = "xoxb-..."'}

Write-Host "Шлюз Kova настроен на провайдер: $env:KOVA_PROVIDER_MODEL ($env:KOVA_EXEC_ENV)" -ForegroundColor Cyan
Write-Host "Для непрерывной работы держите окно PowerShell открытым или запустите через Task Scheduler." -ForegroundColor Gray`;
}
