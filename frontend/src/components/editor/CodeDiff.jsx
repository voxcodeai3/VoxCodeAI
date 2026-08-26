import { useState, useMemo } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';

/**
 * Simple line-by-line diff view showing before/after code changes.
 */
export default function CodeDiff({ original, modified, onAccept, onReject, language }) {
  const [side, setSide] = useState('split'); // 'split' | 'unified'

  const diffLines = useMemo(() => {
    const oldLines = (original || '').split('\n');
    const newLines = (modified || '').split('\n');
    const maxLen = Math.max(oldLines.length, newLines.length);
    const lines = [];

    // Simple LCS-based diff.
    const lcs = buildLCS(oldLines, newLines);
    let oldIdx = 0;
    let newIdx = 0;
    let lcsIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (
        lcsIdx < lcs.length &&
        oldIdx < oldLines.length &&
        newIdx < newLines.length &&
        oldLines[oldIdx] === lcs[lcsIdx] &&
        newLines[newIdx] === lcs[lcsIdx]
      ) {
        lines.push({ type: 'same', old: oldLines[oldIdx], new: newLines[newIdx] });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else if (
        newIdx >= newLines.length ||
        (oldIdx < oldLines.length &&
          lcsIdx < lcs.length &&
          oldLines[oldIdx] !== lcs[lcsIdx])
      ) {
        lines.push({ type: 'removed', old: oldLines[oldIdx], new: null });
        oldIdx++;
      } else {
        lines.push({ type: 'added', old: null, new: newLines[newIdx] });
        newIdx++;
      }
    }

    return lines;
  }, [original, modified]);

  const addedCount = diffLines.filter((l) => l.type === 'added').length;
  const removedCount = diffLines.filter((l) => l.type === 'removed').length;

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.06] bg-[#0a0f1e] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/60 font-medium">Changes</span>
          <span className="text-[10px] text-emerald-400/60">+{addedCount}</span>
          <span className="text-[10px] text-red-400/60">-{removedCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReject}
            className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-1.5 text-[10px] text-white/40 hover:text-red-300 hover:border-red-400/20 transition-all"
          >
            <X className="h-3 w-3" />
            Reject
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] text-emerald-300 hover:bg-emerald-400/[0.12] transition-all"
          >
            <Check className="h-3 w-3" />
            Accept
          </button>
        </div>
      </div>

      {/* Diff lines */}
      <div className="max-h-[300px] overflow-y-auto font-mono text-[11px] leading-5">
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={`flex border-b border-white/[0.02] ${
              line.type === 'added'
                ? 'bg-emerald-400/[0.06]'
                : line.type === 'removed'
                  ? 'bg-red-400/[0.06]'
                  : ''
            }`}
          >
            {side === 'split' ? (
              <>
                <div className="w-1/2 border-r border-white/[0.04] px-3 py-0.5">
                  {line.type === 'removed' ? (
                    <span className="text-red-300/70">{line.old}</span>
                  ) : (
                    <span className="text-white/30">{line.old}</span>
                  )}
                </div>
                <div className="w-1/2 px-3 py-0.5">
                  {line.type === 'added' ? (
                    <span className="text-emerald-300/70">{line.new}</span>
                  ) : (
                    <span className="text-white/30">{line.new}</span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center w-full px-3 py-0.5">
                <span className="w-5 text-center shrink-0">
                  {line.type === 'added' ? (
                    <span className="text-emerald-400">+</span>
                  ) : line.type === 'removed' ? (
                    <span className="text-red-400">-</span>
                  ) : (
                    <span className="text-white/15"> </span>
                  )}
                </span>
                <span
                  className={
                    line.type === 'added'
                      ? 'text-emerald-300/70'
                      : line.type === 'removed'
                        ? 'text-red-300/70'
                        : 'text-white/50'
                  }
                >
                  {line.type === 'removed' ? line.old : line.new}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple Longest Common Subsequence for line diffing. */
function buildLCS(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}
