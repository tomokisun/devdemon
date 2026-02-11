import type { Task } from '../../queue/types.js';
import type { LogEntry } from '../../agent/message-stream.js';
import { MAX_LOG_ENTRIES } from '../../constants.js';

export interface CurrentTaskState {
  task: Task;
  entries: LogEntry[];
  streamingText: string;
  cycleStartedAt: number;
  currentTokens: number;
}

export function addEntryToState(prev: CurrentTaskState, entry: LogEntry): CurrentTaskState {
  const newEntries = [...prev.entries, entry];
  const trimmed = newEntries.length > MAX_LOG_ENTRIES
    ? newEntries.slice(-MAX_LOG_ENTRIES)
    : newEntries;
  return { ...prev, entries: trimmed };
}
