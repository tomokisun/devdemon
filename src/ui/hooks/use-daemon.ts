import { useState, useEffect, useRef } from 'react';
import type { Daemon } from '../../daemon/daemon.js';
import type { Task } from '../../queue/types.js';
import type { TaskLogEntry } from '../components/task-log.js';
import { MessageStream } from '../../agent/message-stream.js';
import type { LogEntry, SDKMessagePayload } from '../../agent/message-stream.js';
import type { AgentResult } from '../../agent/agent.js';
import { formatMs } from '../../utils/format.js';
import type { CurrentTaskState } from './use-daemon-state.js';
import { addEntryToState } from './use-daemon-state.js';
import { processEvents } from './use-daemon-events.js';
import { randomThinkingVerb } from './format-utils.js';

export type { CurrentTaskState } from './use-daemon-state.js';

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

      stream.resetTokens();
      setCurrentTask({ task, entries, streamingText: '', cycleStartedAt: Date.now(), currentTokens: 0 });
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

    const onMessage = (msg: SDKMessagePayload) => {
      // First flush any pending stream buffer if this is a non-stream message
      if (msg.type !== 'stream_event') {
        const flushed = stream.flushStream();
        if (flushed && flushed.type === 'log') {
          setCurrentTask(prev => {
            if (!prev) return prev;
            return addEntryToState(prev, flushed.entry);
          });
        }
      }

      const events = stream.processMessage(msg);
      if (!events) return;

      const eventList = Array.isArray(events) ? events : [events];
      processEvents(eventList, setCurrentTask, setInitInfo);
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
