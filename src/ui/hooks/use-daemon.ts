import { useState, useEffect, useRef } from 'react';
import type { Daemon } from '../../daemon/daemon.js';
import type { Task } from '../../queue/types.js';
import type { TaskLogEntry } from '../components/task-log.js';
import { MessageStream } from '../../agent/message-stream.js';
import type { LogEntry } from '../../agent/message-stream.js';
import type { AgentResult } from '../../agent/agent.js';

export interface CurrentTaskState {
  task: Task;
  entries: LogEntry[];
  streamingText: string;
  cycleStartedAt: number;
}

const MAX_ENTRIES = 200;

function addEntryToState(prev: CurrentTaskState, entry: LogEntry): CurrentTaskState {
  const newEntries = [...prev.entries, entry];
  const trimmed = newEntries.length > MAX_ENTRIES
    ? newEntries.slice(-MAX_ENTRIES)
    : newEntries;
  return { ...prev, entries: trimmed };
}

function formatMs(ms: number): string {
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  }
  return `${Math.round(ms / 1000)}s`;
}

const BATCHABLE_TOOLS = new Set(['Read', 'Grep', 'Glob']);

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

function formatBatchText(tools: Array<{ toolName: string; count: number }>): string {
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

function tryMergeBatch(entries: LogEntry[], newEntry: LogEntry): LogEntry[] | null {
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

const THINKING_VERBS = [
  'Baked', 'Cooked', 'Churned', 'Cogitated', 'Worked',
  'Mulled', 'Pondered', 'Brewed', 'Stewed', 'Crafted',
];

function randomThinkingVerb(): string {
  return THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
}

export function useDaemon(daemon: Daemon) {
  const [status, setStatus] = useState<'idle' | 'running' | 'waiting'>('idle');
  const [currentTask, setCurrentTask] = useState<CurrentTaskState | null>(null);
  const [taskLog, setTaskLog] = useState<TaskLogEntry[]>([]);
  const [stats, setStats] = useState(daemon.state.getStats());
  const [initInfo, setInitInfo] = useState<{ model: string } | null>(null);
  const cycleCountRef = useRef(0);

  useEffect(() => {
    const stream = new MessageStream();

    const onCycleStart = (task: Task) => {
      setStatus('running');
      cycleCountRef.current += 1;

      const entries: LogEntry[] = [];

      // Add cycle separator (except for first cycle)
      if (cycleCountRef.current > 1) {
        entries.push({
          kind: 'cycle_separator',
          text: '\u2500'.repeat(60),
          timestamp: Date.now(),
        });
      }

      // Add user task prompt
      entries.push({
        kind: 'user_task',
        text: task.prompt,
        timestamp: Date.now(),
      });

      setCurrentTask({ task, entries, streamingText: '', cycleStartedAt: Date.now() });
      setTaskLog(prev => [
        ...prev,
        {
          id: task.id,
          status: 'running' as const,
          prompt: task.prompt,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const addEntry = (entry: LogEntry) => {
      setCurrentTask(prev => {
        if (!prev) return prev;
        return addEntryToState(prev, entry);
      });
    };

    const onMessage = (msg: any) => {
      // First flush any pending stream buffer if this is a non-stream message
      if (msg.type !== 'stream_event') {
        const flushed = stream.flushStream();
        if (flushed && flushed.type === 'log') {
          addEntry(flushed.entry);
        }
      }

      const events = stream.processMessage(msg);
      if (!events) return;

      const eventList = Array.isArray(events) ? events : [events];

      for (const event of eventList) {
        if (event.type === 'log') {
          if (event.entry.kind === 'stream_text') {
            // Accumulate streaming text
            setCurrentTask(prev => {
              if (!prev) return prev;
              return { ...prev, streamingText: prev.streamingText + event.entry.text };
            });
          } else if (event.entry.kind === 'tool_progress' && event.entry.toolUseId) {
            // Replace existing progress entry for same toolUseId
            setCurrentTask(prev => {
              if (!prev) return prev;
              const idx = prev.entries.findLastIndex(
                e => e.kind === 'tool_progress' && e.toolUseId === event.entry.toolUseId
              );
              if (idx >= 0) {
                const updated = [...prev.entries];
                updated[idx] = event.entry;
                return { ...prev, entries: updated };
              }
              return addEntryToState(prev, event.entry);
            });
          } else if (event.entry.kind === 'tool_group' && event.entry.toolUseId) {
            // Replace the pending tool_use entry with the merged tool_group
            // Also remove any tool_progress entries for same toolUseId
            setCurrentTask(prev => {
              if (!prev) return prev;
              const toolUseIdx = prev.entries.findLastIndex(
                e => e.kind === 'tool_use' && e.toolUseId === event.entry.toolUseId
              );

              let baseEntries: LogEntry[];
              if (toolUseIdx >= 0) {
                // Filter out tool_progress for same toolUseId, then replace the tool_use
                const filtered = prev.entries.filter(
                  (e, i) => i === toolUseIdx || !(e.kind === 'tool_progress' && e.toolUseId === event.entry.toolUseId)
                );
                const newIdx = filtered.indexOf(prev.entries[toolUseIdx]);
                baseEntries = [...filtered];
                baseEntries[newIdx] = event.entry;
              } else {
                baseEntries = [...prev.entries, event.entry];
              }

              // Try batch merge for batchable tools (Read/Grep/Glob)
              const batchResult = tryMergeBatch(baseEntries, event.entry);
              if (batchResult) {
                return { ...prev, entries: batchResult, streamingText: '' };
              }

              // Try task agents summary for consecutive Task tool_groups with stats
              if (event.entry.toolName === 'Task' && event.entry.toolStats) {
                const lastIdx = baseEntries.length - 1;
                // The new entry was already placed at some index, find it
                const newEntryIdx = baseEntries.findLastIndex(e => e === event.entry);
                if (newEntryIdx > 0) {
                  const prevEntry = baseEntries[newEntryIdx - 1];

                  if (prevEntry.kind === 'task_agents_summary' && prevEntry.childEntries) {
                    // Extend existing summary
                    const updated = [...baseEntries];
                    updated[newEntryIdx - 1] = {
                      ...prevEntry,
                      childEntries: [...prevEntry.childEntries, event.entry],
                      text: `${prevEntry.childEntries.length + 1} Task agents finished`,
                      timestamp: event.entry.timestamp,
                    };
                    updated.splice(newEntryIdx, 1); // Remove the individual entry
                    return { ...prev, entries: updated, streamingText: '' };
                  }

                  if (prevEntry.kind === 'tool_group' && prevEntry.toolName === 'Task' && prevEntry.toolStats) {
                    // Combine two Task tool_groups into a summary
                    const updated = [...baseEntries];
                    updated[newEntryIdx - 1] = {
                      kind: 'task_agents_summary',
                      text: '2 Task agents finished',
                      timestamp: event.entry.timestamp,
                      childEntries: [prevEntry, event.entry],
                    };
                    updated.splice(newEntryIdx, 1); // Remove the individual entry
                    return { ...prev, entries: updated, streamingText: '' };
                  }
                }
              }

              return { ...prev, entries: baseEntries, streamingText: '' };
            });
          } else {
            // Normal entry: add and clear streaming text
            setCurrentTask(prev => {
              if (!prev) return prev;
              return addEntryToState({ ...prev, streamingText: '' }, event.entry);
            });
          }
        } else if (event.type === 'init') {
          // Display init info as a log entry
          setInitInfo({ model: event.model });
          const initEntry: LogEntry = {
            kind: 'system_init',
            text: `Session ${event.sessionId} | Model: ${event.model} | Tools: ${event.tools.length}`,
            timestamp: Date.now(),
          };
          setCurrentTask(prev => {
            if (!prev) return prev;
            return addEntryToState(prev, initEntry);
          });
        }
        // completion and error are handled by cycle-complete/cycle-error events
      }
    };

    const onCycleComplete = ({ task, result }: { task: Task; result: AgentResult }) => {
      const thinkingVerb = randomThinkingVerb();
      const thinkingEntry: LogEntry = {
        kind: 'thinking_time',
        text: `${thinkingVerb} for ${formatMs(result.durationMs)}`,
        timestamp: Date.now(),
      };

      const summaryEntry: LogEntry = {
        kind: 'result_success',
        text: `Completed ($${result.costUsd.toFixed(2)} \u00B7 ${result.numTurns} turn${result.numTurns !== 1 ? 's' : ''} \u00B7 ${formatMs(result.durationMs)})`,
        timestamp: Date.now(),
      };

      setCurrentTask(prev => {
        if (!prev) return prev;
        let state = addEntryToState(prev, thinkingEntry);
        state = addEntryToState(state, summaryEntry);
        return state;
      });

      // Delay clearing so the summary is visible
      setTimeout(() => {
        setStatus('waiting');
        setCurrentTask(null);
        setTaskLog(prev =>
          prev.map(e =>
            e.id === task.id ? { ...e, status: 'completed' as const } : e,
          ),
        );
        setStats(daemon.state.getStats());
      }, 100);
    };

    const onCycleError = ({ task, error }: { task: Task; error: unknown }) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const summaryEntry: LogEntry = {
        kind: 'result_error',
        text: `Failed: ${errorMsg}`,
        timestamp: Date.now(),
      };
      setCurrentTask(prev => {
        if (!prev) return prev;
        return addEntryToState(prev, summaryEntry);
      });

      setTimeout(() => {
        setStatus('waiting');
        setCurrentTask(null);
        setTaskLog(prev =>
          prev.map(e =>
            e.id === task.id ? { ...e, status: 'failed' as const } : e,
          ),
        );
        setStats(daemon.state.getStats());
      }, 100);
    };

    daemon.on('cycle-start', onCycleStart);
    daemon.agent.on('message', onMessage);
    daemon.on('cycle-complete', onCycleComplete);
    daemon.on('cycle-error', onCycleError);

    return () => {
      daemon.off('cycle-start', onCycleStart);
      daemon.agent.off('message', onMessage);
      daemon.off('cycle-complete', onCycleComplete);
      daemon.off('cycle-error', onCycleError);
    };
  }, [daemon]);

  return { status, currentTask, taskLog, stats, initInfo };
}
