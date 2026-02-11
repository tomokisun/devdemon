import type { LogEntry } from '../../agent/message-stream.js';

export const BATCHABLE_TOOLS = new Set(['Read', 'Grep', 'Glob']);

const TOOL_BATCH_VERBS: Record<string, string> = {
  Read: 'read',
  Grep: 'searched for',
  Glob: 'searched for',
};

const TOOL_BATCH_NOUNS: Record<string, string> = {
  Read: 'file',
  Grep: 'pattern',
  Glob: 'pattern',
};

export function formatBatchText(tools: Array<{ toolName: string; count: number }>): string {
  // Group searches first, then reads
  const searches = tools.filter(t => t.toolName === 'Grep' || t.toolName === 'Glob');
  const reads = tools.filter(t => t.toolName === 'Read');
  const others = tools.filter(t => !['Grep', 'Glob', 'Read'].includes(t.toolName));

  const parts: string[] = [];

  if (searches.length > 0) {
    const totalSearches = searches.reduce((sum, s) => sum + s.count, 0);
    parts.push(`Searched for ${totalSearches} pattern${totalSearches !== 1 ? 's' : ''}`);
  }
  if (reads.length > 0) {
    const totalReads = reads.reduce((sum, r) => sum + r.count, 0);
    parts.push(`read ${totalReads} file${totalReads !== 1 ? 's' : ''}`);
  }
  for (const t of others) {
    const verb = TOOL_BATCH_VERBS[t.toolName] ?? t.toolName.toLowerCase();
    const noun = TOOL_BATCH_NOUNS[t.toolName] ?? 'item';
    parts.push(`${verb} ${t.count} ${noun}${t.count !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

export function tryMergeBatch(entries: LogEntry[], newEntry: LogEntry): LogEntry[] | null {
  if (newEntry.kind !== 'tool_group' || !newEntry.toolName) return null;
  if (!BATCHABLE_TOOLS.has(newEntry.toolName)) return null;

  const lastIdx = entries.length - 1;
  if (lastIdx < 0) return null;
  const last = entries[lastIdx];

  // If last is already a tool_batch, extend it
  if (last.kind === 'tool_batch' && last.batchedTools) {
    const batchedTools = last.batchedTools.map(b => ({ ...b }));
    const existing = batchedTools.find(b => b.toolName === newEntry.toolName);
    if (existing) {
      existing.count++;
    } else {
      batchedTools.push({ toolName: newEntry.toolName!, count: 1 });
    }
    const updated = [...entries];
    updated[lastIdx] = {
      ...last,
      text: formatBatchText(batchedTools),
      timestamp: newEntry.timestamp,
      batchedTools,
    };
    return updated;
  }

  // If last is a batchable tool_group, convert both into a tool_batch
  if (last.kind === 'tool_group' && last.toolName && BATCHABLE_TOOLS.has(last.toolName)) {
    const batchedTools: Array<{ toolName: string; count: number }> = [];
    batchedTools.push({ toolName: last.toolName!, count: 1 });

    const existing = batchedTools.find(b => b.toolName === newEntry.toolName);
    if (existing) {
      existing.count++;
    } else {
      batchedTools.push({ toolName: newEntry.toolName!, count: 1 });
    }

    const updated = [...entries];
    updated[lastIdx] = {
      kind: 'tool_batch',
      text: formatBatchText(batchedTools),
      timestamp: newEntry.timestamp,
      batchedTools,
    };
    return updated;
  }

  return null;
}
