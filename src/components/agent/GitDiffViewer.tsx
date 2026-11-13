import React, { useMemo, useState } from 'react';
import { Check, FileCode2, RotateCcw, X } from 'lucide-react';
import type { DiffProposal } from '../../types/kova';
import { computeLineDiff } from '../../utils/diff';
import { cn } from '../../utils/cn';

interface GitDiffViewerProps {
  diff: DiffProposal;
  onApply: () => void;
  onReject: () => void;
  onRollback?: (checkpointId: string) => void;
}

function highlightCodeLine(text: string): React.ReactNode {
  const keywords = /\b(use|pub|fn|let|mut|async|await|match|if|else|return|struct|impl|const|export|import|from|type|interface)\b/g;
  const parts = text.split(keywords);
  return parts.map((part, idx) => {
    if (keywords.test(part)) {
      return (
        <span key={idx} className="text-blue-600 dark:text-blue-400 font-medium">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const GitDiffViewer: React.FC<GitDiffViewerProps> = ({
  diff,
  onApply,
  onReject,
  onRollback,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const { lines, addedCount, removedCount } = useMemo(
    () => computeLineDiff(diff.oldContent, diff.newContent, 2),
    [diff.oldContent, diff.newContent],
  );

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-[#0D0D10]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 min-w-0 text-left group"
        >
          <FileCode2 className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-500 transition-colors">
            {diff.filePath}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
            +{addedCount}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-rose-600 dark:text-rose-400 shrink-0">
            -{removedCount}
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {diff.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={onReject}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 inline-flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span>Отклонить</span>
              </button>
              <button
                type="button"
                onClick={onApply}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Применить дифф</span>
              </button>
            </>
          )}
          {diff.status === 'applied' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Применено
              </span>
              {diff.checkpointId && onRollback && (
                <button
                  type="button"
                  onClick={() => onRollback(diff.checkpointId!)}
                  className="px-2 py-1 rounded text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Откатить</span>
                </button>
              )}
            </div>
          )}
          {diff.status === 'rejected' && (
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Отклонено
            </span>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="font-mono text-[12px] leading-5 overflow-x-auto max-h-80 overflow-y-auto">
          {lines.map((line, idx) => {
            if (line.text === '...' && line.oldNum === null && line.newNum === null) {
              return (
                <div
                  key={idx}
                  className="px-3 py-0.5 text-[11px] text-zinc-400 dark:text-zinc-600 bg-zinc-50/70 dark:bg-zinc-900/40 border-y border-zinc-100 dark:border-zinc-800/60 select-none"
                >
                  ··· контекст свёрнут ···
                </div>
              );
            }

            return (
              <div
                key={idx}
                className={cn(
                  'flex items-stretch min-w-max',
                  line.type === 'add' && 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
                  line.type === 'remove' && 'bg-rose-500/10 text-rose-900 dark:text-rose-200',
                  line.type === 'context' && 'text-zinc-600 dark:text-zinc-400',
                )}
              >
                <span className="w-10 px-2 text-right select-none opacity-45 tabular-nums border-r border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
                  {line.oldNum ?? ''}
                </span>
                <span className="w-10 px-2 text-right select-none opacity-45 tabular-nums border-r border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
                  {line.newNum ?? ''}
                </span>
                <span
                  className={cn(
                    'w-6 text-center select-none font-semibold shrink-0',
                    line.type === 'add' && 'text-emerald-600 dark:text-emerald-400',
                    line.type === 'remove' && 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                <pre className="pr-4 whitespace-pre">
                  {line.type === 'context' ? highlightCodeLine(line.text) : line.text}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
