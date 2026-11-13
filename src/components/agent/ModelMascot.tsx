import React from 'react';
import { motion } from 'motion/react';
import type { RolePersonaKind, ServerStatus } from '../../types/kova';
import { cn } from '../../utils/cn';

interface ModelMascotProps {
  status: ServerStatus;
  persona: RolePersonaKind;
  roleName: string;
  modelName?: string;
  tokensPerSec?: number;
  compact?: boolean;
  onClick?: () => void;
}

const PERSONA_COLORS: Record<RolePersonaKind, string> = {
  developer: '#3B82F6',
  architect: '#8B5CF6',
  reviewer: '#F59E0B',
  qa: '#10B981',
  custom: '#06B6D4',
};

const STATUS_TEXT: Record<ServerStatus, string> = {
  ready: 'Наблюдает за контекстом',
  generating: 'Пишет ответ и код',
  loading: 'Загружает веса в VRAM',
  stopped: 'Спящий режим',
  error: 'Обнаружена ошибка',
};

export const ModelMascot: React.FC<ModelMascotProps> = ({
  status,
  persona,
  roleName,
  modelName,
  tokensPerSec = 0,
  compact = false,
  onClick,
}) => {
  const accent = status === 'error' ? '#EF4444' : status === 'stopped' ? '#71717A' : PERSONA_COLORS[persona];
  const isSleeping = status === 'stopped';
  const isGenerating = status === 'generating';
  const isLoading = status === 'loading';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors w-full',
        compact ? 'p-2.5 flex items-center gap-3' : 'p-3.5 flex items-center gap-3.5',
      )}
    >
      <div className="relative shrink-0">
        <motion.svg
          width={compact ? 48 : 60}
          height={compact ? 48 : 60}
          viewBox="0 0 80 80"
          fill="none"
          aria-label={`Персонаж модели в роли ${roleName}`}
          animate={
            isGenerating
              ? { y: [0, -2.5, 0] }
              : isSleeping
                ? { y: [0, 1, 0] }
                : { y: [0, -1.5, 0] }
          }
          transition={{
            duration: isGenerating ? 0.65 : 2.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Ambient aura ring for active states */}
          <motion.circle
            cx="40"
            cy="42"
            r="34"
            stroke={accent}
            strokeWidth="1.2"
            strokeDasharray={isLoading ? '10 6' : 'none'}
            opacity={isSleeping ? 0.12 : 0.28}
            animate={isLoading ? { rotate: 360 } : { scale: isGenerating ? [1, 1.05, 1] : 1 }}
            transition={
              isLoading
                ? { duration: 2.2, repeat: Infinity, ease: 'linear' }
                : { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
            }
            style={{ originX: '40px', originY: '42px' }}
          />

          {/* Top antenna / role crest */}
          <line x1="40" y1="10" x2="40" y2="18" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
          <motion.circle
            cx="40"
            cy="8"
            r="3.2"
            fill={accent}
            animate={
              isGenerating
                ? { opacity: [1, 0.35, 1], scale: [1, 1.25, 1] }
                : { opacity: isSleeping ? 0.3 : 0.9 }
            }
            transition={{ duration: 0.7, repeat: Infinity }}
          />

          {/* Chassis head */}
          <rect
            x="16"
            y="18"
            width="48"
            height="42"
            rx="14"
            className="fill-zinc-100 dark:fill-zinc-900 stroke-zinc-300 dark:stroke-zinc-700"
            strokeWidth="2"
          />

          {/* Visor screen */}
          <rect
            x="22"
            y="25"
            width="36"
            height="22"
            rx="8"
            fill="#09090B"
            stroke={accent}
            strokeOpacity={isSleeping ? 0.25 : 0.65}
            strokeWidth="1.4"
          />

          {/* Eyes */}
          {isSleeping ? (
            <>
              <path d="M29 36H35" stroke="#71717A" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M45 36H51" stroke="#71717A" strokeWidth="2.4" strokeLinecap="round" />
            </>
          ) : status === 'error' ? (
            <>
              <path d="M29 33L35 39M35 33L29 39" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M45 33L51 39M51 33L45 39" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <motion.rect
                x="29"
                y="32"
                width="5.5"
                height="8"
                rx="2.7"
                fill={accent}
                animate={
                  isGenerating
                    ? { scaleY: [1, 0.7, 1], x: [0, 1.5, -1, 0] }
                    : { scaleY: [1, 1, 0.15, 1] }
                }
                transition={
                  isGenerating
                    ? { duration: 0.9, repeat: Infinity }
                    : { duration: 4.2, repeat: Infinity, times: [0, 0.92, 0.96, 1] }
                }
                style={{ originY: '36px' }}
              />
              <motion.rect
                x="45.5"
                y="32"
                width="5.5"
                height="8"
                rx="2.7"
                fill={accent}
                animate={
                  isGenerating
                    ? { scaleY: [1, 0.7, 1], x: [0, 1.5, -1, 0] }
                    : { scaleY: [1, 1, 0.15, 1] }
                }
                transition={
                  isGenerating
                    ? { duration: 0.9, repeat: Infinity }
                    : { duration: 4.2, repeat: Infinity, times: [0, 0.92, 0.96, 1] }
                }
                style={{ originY: '36px' }}
              />
            </>
          )}

          {/* Mouth / activity waveform */}
          {isGenerating ? (
            <motion.path
              d="M32 52 Q36 49 40 52 T48 52"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              animate={{ d: ['M32 52 Q36 49 40 52 T48 52', 'M32 52 Q36 55 40 52 T48 52', 'M32 52 Q36 49 40 52 T48 52'] }}
              transition={{ duration: 0.45, repeat: Infinity }}
            />
          ) : (
            <line
              x1="34"
              y1="52"
              x2="46"
              y2="52"
              stroke={isSleeping ? '#52525B' : accent}
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.75}
            />
          )}

          {/* Role-specific emblem on chest/base */}
          <g transform="translate(28, 62)">
            <rect x="0" y="0" width="24" height="11" rx="5.5" fill={accent} fillOpacity="0.16" stroke={accent} strokeWidth="1.2" />
            {persona === 'architect' && (
              <path d="M12 2.5L8 8.5H16L12 2.5Z" stroke={accent} strokeWidth="1.3" strokeLinejoin="round" />
            )}
            {persona === 'developer' && (
              <path d="M9.5 3.5L7 5.5L9.5 7.5M14.5 3.5L17 5.5L14.5 7.5" stroke={accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {persona === 'reviewer' && (
              <circle cx="12" cy="5.5" r="2.6" stroke={accent} strokeWidth="1.3" />
            )}
            {persona === 'qa' && (
              <path d="M8.5 5.5L11 7.8L15.5 3.3" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {persona === 'custom' && (
              <path d="M12 2.5L13.6 5.5L12 8.5L10.4 5.5Z" fill={accent} />
            )}
          </g>
        </motion.svg>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            Кова · {roleName}
          </span>
          <span className="font-mono text-[10.5px] tabular-nums shrink-0" style={{ color: accent }}>
            {isGenerating && tokensPerSec > 0 ? `${tokensPerSec} tok/s` : status === 'stopped' ? 'OFF' : 'ON'}
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
          {STATUS_TEXT[status]}
        </div>
        {modelName && !compact && (
          <div className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
            {modelName}
          </div>
        )}
      </div>
    </button>
  );
};
