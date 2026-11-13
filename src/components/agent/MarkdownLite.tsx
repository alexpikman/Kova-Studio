import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownLiteProps {
  content: string;
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-zinc-950 dark:text-zinc-50">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic text-zinc-700 dark:text-zinc-300">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/90 text-blue-700 dark:text-blue-300 border border-zinc-200/80 dark:border-zinc-700/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

const CodeFence: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
        <span className="font-mono">{lang || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 hover:text-zinc-100 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Скопировано' : 'Копировать'}</span>
        </button>
      </div>
      <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto">{code}</pre>
    </div>
  );
};

export const MarkdownLite: React.FC<MarkdownLiteProps> = ({ content }) => {
  const segments = content.split(/```(\w*)\n([\s\S]*?)```/g);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < segments.length; i += 3) {
    const textChunk = segments[i];
    const lang = segments[i + 1];
    const code = segments[i + 2];

    if (textChunk) {
      const lines = textChunk.split('\n');
      lines.forEach((line, lineIdx) => {
        const key = `${i}-${lineIdx}`;
        if (line.startsWith('### ')) {
          nodes.push(
            <h4 key={key} className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-3 mb-1.5">
              {renderInline(line.slice(4))}
            </h4>,
          );
        } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          nodes.push(
            <div key={key} className="flex items-start gap-2 pl-2 my-0.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-400 select-none mt-1">·</span>
              <span>{renderInline(line.trim().slice(2))}</span>
            </div>,
          );
        } else if (/^\d+\.\s/.test(line.trim())) {
          const match = line.trim().match(/^(\d+\.)\s(.*)$/);
          nodes.push(
            <div key={key} className="flex items-start gap-2 pl-1 my-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              <span className="font-mono text-xs text-zinc-500 mt-0.5 tabular-nums">{match?.[1]}</span>
              <span>{renderInline(match?.[2] ?? line)}</span>
            </div>,
          );
        } else if (line.trim() === '') {
          nodes.push(<div key={key} className="h-1.5" />);
        } else {
          nodes.push(
            <p key={key} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {renderInline(line)}
            </p>,
          );
        }
      });
    }

    if (code !== undefined) {
      nodes.push(<CodeFence key={`code-${i}`} lang={lang || 'code'} code={code.trimEnd()} />);
    }
  }

  return <div>{nodes}</div>;
};
