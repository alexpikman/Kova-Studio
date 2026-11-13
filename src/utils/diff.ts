export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  oldNum: number | null;
  newNum: number | null;
  text: string;
}

/**
 * Computes a clean line-level LCS diff with compact context collapse
 * for crisp Git-style rendering inside the agent chat stream.
 */
export function computeLineDiff(oldText: string, newText: string, contextLines = 2): {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
} {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const raw: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;
  let addedCount = 0;
  let removedCount = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ type: 'context', oldNum: oldLine++, newNum: newLine++, text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'remove', oldNum: oldLine++, newNum: null, text: a[i] });
      removedCount++;
      i++;
    } else {
      raw.push({ type: 'add', oldNum: null, newNum: newLine++, text: b[j] });
      addedCount++;
      j++;
    }
  }
  while (i < n) {
    raw.push({ type: 'remove', oldNum: oldLine++, newNum: null, text: a[i++] });
    removedCount++;
  }
  while (j < m) {
    raw.push({ type: 'add', oldNum: null, newNum: newLine++, text: b[j++] });
    addedCount++;
  }

  // Keep lines within `contextLines` of any change
  const keep = new Array<boolean>(raw.length).fill(false);
  raw.forEach((line, idx) => {
    if (line.type !== 'context') {
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(raw.length - 1, idx + contextLines);
      for (let k = start; k <= end; k++) {
        keep[k] = true;
      }
    }
  });

  const compact: DiffLine[] = [];
  let skipped = false;
  for (let idx = 0; idx < raw.length; idx++) {
    if (keep[idx]) {
      if (skipped && compact.length > 0) {
        compact.push({ type: 'context', oldNum: null, newNum: null, text: '...' });
      }
      compact.push(raw[idx]);
      skipped = false;
    } else {
      skipped = true;
    }
  }

  return { lines: compact, addedCount, removedCount };
}
