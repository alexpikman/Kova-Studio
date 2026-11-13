import type { UiStylePreset } from '../types/kova';

export interface UiStyleTokens {
  id: UiStylePreset;
  label: string;
  subtitle: string;
  shellBg: string;
  headerBg: string;
  sidebarBg: string;
  cardBg: string;
  cardBorder: string;
  cardRadius: string;
  inputRadius: string;
  accentButton: string;
  activeHighlight: string;
  taskBannerBg: string;
  userBubbleBg: string;
  assistantBubbleBg: string;
  isMonoHeavy: boolean;
}

export const UI_STYLE_META: Record<UiStylePreset, UiStyleTokens> = {
  'cline-vscode': {
    id: 'cline-vscode',
    label: 'Cline / VS Code',
    subtitle: 'Компактная IDE-сетка, панель задачи как в Cline, строгие углы и фокус на диффах',
    shellBg: 'bg-zinc-100 text-zinc-900 dark:bg-[#18181B] dark:text-zinc-100',
    headerBg: 'bg-white dark:bg-[#1F1F23] border-zinc-200 dark:border-[#2C2C32]',
    sidebarBg: 'bg-zinc-50 dark:bg-[#18181B] border-zinc-200 dark:border-[#2C2C32]',
    cardBg: 'bg-white dark:bg-[#222227]',
    cardBorder: 'border-zinc-200 dark:border-[#32323A]',
    cardRadius: 'rounded-md',
    inputRadius: 'rounded-md',
    accentButton: 'bg-blue-600 hover:bg-blue-500 text-white',
    activeHighlight: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    taskBannerBg: 'bg-zinc-50 dark:bg-[#1E1E24] border-zinc-200 dark:border-[#2E2E36]',
    userBubbleBg: 'border-blue-500/30 bg-blue-50/70 dark:bg-[#1E2430]',
    assistantBubbleBg: 'border-zinc-200 dark:border-[#2E2E36] bg-white dark:bg-[#1F1F25]',
    isMonoHeavy: false,
  },
  'mica-windows': {
    id: 'mica-windows',
    label: 'Windows 11 Mica',
    subtitle: 'Мягкие скругления, полупрозрачный Mica-фон и воздушные карточки Fluent UI',
    shellBg: 'bg-zinc-50 text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100',
    headerBg: 'bg-white/85 dark:bg-[#111114]/85 mica-panel border-zinc-200 dark:border-zinc-800/90',
    sidebarBg: 'bg-zinc-50/80 dark:bg-[#0D0D10] border-zinc-200 dark:border-zinc-800/90',
    cardBg: 'bg-white dark:bg-[#111114]',
    cardBorder: 'border-zinc-200 dark:border-zinc-800',
    cardRadius: 'rounded-xl',
    inputRadius: 'rounded-xl',
    accentButton: 'bg-blue-600 hover:bg-blue-500 text-white',
    activeHighlight: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    taskBannerBg: 'bg-zinc-50/80 dark:bg-[#111114]/90 border-zinc-200 dark:border-zinc-800',
    userBubbleBg: 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50',
    assistantBubbleBg: 'border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#111114]',
    isMonoHeavy: false,
  },
  'cyber-terminal': {
    id: 'cyber-terminal',
    label: 'Терминал Obsidian',
    subtitle: 'Контрастная моноширинная консоль с изумрудным акцентом и чёткими рамками 1px',
    shellBg: 'bg-zinc-100 text-zinc-900 dark:bg-[#050608] dark:text-zinc-100 font-mono',
    headerBg: 'bg-white dark:bg-[#080A0D] border-zinc-300 dark:border-emerald-500/25',
    sidebarBg: 'bg-zinc-50 dark:bg-[#07090C] border-zinc-300 dark:border-emerald-500/20',
    cardBg: 'bg-white dark:bg-[#0A0D12]',
    cardBorder: 'border-zinc-300 dark:border-emerald-500/25',
    cardRadius: 'rounded-sm',
    inputRadius: 'rounded-sm',
    accentButton: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    activeHighlight: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    taskBannerBg: 'bg-zinc-50 dark:bg-[#090C10] border-zinc-300 dark:border-emerald-500/25',
    userBubbleBg: 'border-zinc-300 dark:border-emerald-500/30 bg-zinc-50 dark:bg-[#0C1216]',
    assistantBubbleBg: 'border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#080B0F]',
    isMonoHeavy: true,
  },
};

export function getUiTokens(style: UiStylePreset): UiStyleTokens {
  return UI_STYLE_META[style] ?? UI_STYLE_META['cline-vscode'];
}
