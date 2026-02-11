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
              if (toolUseIdx >= 0) {
                // Filter out tool_progress for same toolUseId, then replace the tool_use
                const filtered = prev.entries.filter(
                  (e, i) => i === toolUseIdx || !(e.kind === 'tool_progress' && e.toolUseId === event.entry.toolUseId)
                );
                const newIdx = filtered.indexOf(prev.entries[toolUseIdx]);
                const updated = [...filtered];
                updated[newIdx] = event.entry;
                return { ...prev, entries: updated, streamingText: '' };
              }
              return addEntryToState({ ...prev, streamingText: '' }, event.entry);
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
      // Add completion summary entry
      const summaryEntry: LogEntry = {
        kind: 'result_success',
        text: `Completed ($${result.costUsd.toFixed(2)} \u00B7 ${result.numTurns} turn${result.numTurns !== 1 ? 's' : ''} \u00B7 ${formatMs(result.durationMs)})`,
        timestamp: Date.now(),
      };
      setCurrentTask(prev => {
        if (!prev) return prev;
        return addEntryToState(prev, summaryEntry);
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
