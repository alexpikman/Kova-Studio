import React from 'react';
import { AlertTriangle, CheckCircle2, Play, SkipForward, Terminal, Wrench } from 'lucide-react';
import type { CommandProposal } from '../../types/kova';
import { cn } from '../../utils/cn';

interface TerminalBlockProps {
  command: CommandProposal;
  onRun: (simulateError?: boolean) => void;
  onSkip: () => void;
  onDiagnose: () => void;
}

export const TerminalBlock: React.FC<TerminalBlockProps> = ({
  command,
  onRun,
  onSkip,
  onDiagnose,
}) => {
  return (
    <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="text-xs font-medium text-zinc-300 shrink-0">
            {command.shell === 'powershell' ? 'PowerShell' : 'cmd.exe'}
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-xs text-zinc-400 truncate">{command.description}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {command.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={onSkip}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 inline-flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Пропустить</span>
              </button>
              <button
                type="button"
                onClick={() => onRun(false)}
                className="px-3 py-1 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Запустить команду</span>
              </button>
            </>
          )}
          {command.status === 'running' && (
            <span className="text-xs font-mono text-amber-400">Выполняется...</span>
          )}
          {command.status === 'success' && (
            <span className="text-xs font-medium text-emerald-400 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Успешно (код 0)
            </span>
          )}
          {command.status === 'failed' && (
            <span className="text-xs font-medium text-rose-400 inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Ошибка (код {command.exitCode ?? 1})
            </span>
          )}
          {command.status === 'skipped' && (
            <span className="text-xs text-zinc-500">Пропущено</span>
          )}
        </div>
      </div>

      <div className="px-3.5 py-2.5 font-mono text-xs bg-zinc-950/90 flex items-center justify-between gap-3">
        <code className="text-zinc-200 overflow-x-auto whitespace-nowrap">{command.command}</code>
        {command.status === 'pending' && (
          <button
            type="button"
            onClick={() => onRun(true)}
            title="Симулировать ошибку компиляции для проверки диагностики"
            className="text-[11px] text-zinc-500 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Тест ошибки
          </button>
        )}
      </div>

      {command.output.length > 0 && (
        <div className="border-t border-zinc-800/80 px-3.5 py-2.5 font-mono text-[11.5px] leading-5 bg-black/50 max-h-52 overflow-y-auto space-y-0.5">
          {command.output.map((line, i) => (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap break-all',
                line.includes('error') ? 'text-rose-400' : line.includes('Finished') ? 'text-emerald-400' : 'text-zinc-400',
              )}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {command.status === 'failed' && command.canDiagnose && (
        <div className="px-3.5 py-2 bg-rose-950/30 border-t border-rose-900/40 flex items-center justify-between gap-2">
          <span className="text-xs text-rose-300">
            Обнаружена ошибка сборки Rust. Агент может проанализировать stderr и предложить исправление.
          </span>
          <button
            type="button"
            onClick={onDiagnose}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Исправить ошибку</span>
          </button>
        </div>
      )}
    </div>
  );
};
