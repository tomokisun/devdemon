import type { LogEntry, UIEvent } from '../../agent/message-stream.js';
import type { CurrentTaskState } from './use-daemon-state.js';
import type { TaskAgentProgress } from './use-daemon-state.js';
import { addEntryToState } from './use-daemon-state.js';
import { tryMergeBatch } from './tool-batching.js';

type SetCurrentTask = React.Dispatch<React.SetStateAction<CurrentTaskState | null>>;
type SetInitInfo = React.Dispatch<React.SetStateAction<{ model: string } | null>>;

function addEntry(setCurrentTask: SetCurrentTask, entry: LogEntry): void {
  setCurrentTask(prev => {
    if (!prev) return prev;
    return addEntryToState(prev, entry);
  });
}

/** Register a new Task agent as running in the progress tracker. */
function trackTaskAgentStarted(prev: CurrentTaskState, entry: LogEntry): TaskAgentProgress {
  const progress = prev.taskAgentProgress;
  // Derive a short description from the tool_use text (e.g. "Task(Fix auth)" -> "Fix auth")
  const match = entry.text.match(/^Task\((.+)\)$/);
  const name = match ? match[1] : entry.text;
  return {
    total: progress.total + 1,
    completed: progress.completed,
    agents: [...progress.agents, { name, status: 'running' }],
  };
}

/** Mark a Task agent as completed in the progress tracker (by toolUseId). */
function trackTaskAgentCompleted(prev: CurrentTaskState, toolUseId: string): TaskAgentProgress {
  const progress = prev.taskAgentProgress;
  // Find the agent entry that corresponds to this toolUseId by matching index
  // Since agents are appended in order and tool_use entries are matched by toolUseId,
  // we find the first 'running' agent to mark as completed.
  let found = false;
  const updatedAgents = progress.agents.map(agent => {
    if (!found && agent.status === 'running') {
      found = true;
      return { ...agent, status: 'completed' as const };
    }
    return agent;
  });
  return {
    total: progress.total,
    completed: progress.completed + (found ? 1 : 0),
    agents: updatedAgents,
  };
}

export function processEvents(
  eventList: UIEvent[],
  setCurrentTask: SetCurrentTask,
  setInitInfo: SetInitInfo,
): void {
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
        processToolGroup(event.entry, setCurrentTask);
      } else if (event.entry.kind === 'tool_use' && event.entry.toolName === 'Task') {
        // Track new Task agent as running, and add entry normally
        setCurrentTask(prev => {
          if (!prev) return prev;
          const updatedProgress = trackTaskAgentStarted(prev, event.entry);
          return addEntryToState({ ...prev, streamingText: '', taskAgentProgress: updatedProgress }, event.entry);
        });
      } else {
        // Normal entry: add and clear streaming text
        setCurrentTask(prev => {
          if (!prev) return prev;
          return addEntryToState({ ...prev, streamingText: '' }, event.entry);
        });
      }
    } else if (event.type === 'token_update') {
      // Update the running token count
      setCurrentTask(prev => {
        if (!prev) return prev;
        return { ...prev, currentTokens: event.totalTokens };
      });
    } else if (event.type === 'init') {
      // Display init info as a log entry
      setInitInfo({ model: event.model });
      const initEntry: LogEntry = {
        kind: 'system_init',
        text: `Session ${event.sessionId} | Model: ${event.model} | Tools: ${event.tools.length}`,
        timestamp: Date.now(),
      };
      addEntry(setCurrentTask, initEntry);
    }
    // completion and error are handled by cycle-complete/cycle-error events
  }
}

function processToolGroup(entry: LogEntry, setCurrentTask: SetCurrentTask): void {
  // Replace the pending tool_use entry with the merged tool_group
  // Also remove any tool_progress entries for same toolUseId
  setCurrentTask(prev => {
    if (!prev) return prev;
    const toolUseIdx = prev.entries.findLastIndex(
      e => e.kind === 'tool_use' && e.toolUseId === entry.toolUseId
    );

    let baseEntries: LogEntry[];
    if (toolUseIdx >= 0) {
      // Filter out tool_progress for same toolUseId, then replace the tool_use
      const filtered = prev.entries.filter(
        (e, i) => i === toolUseIdx || !(e.kind === 'tool_progress' && e.toolUseId === entry.toolUseId)
      );
      const newIdx = filtered.indexOf(prev.entries[toolUseIdx]);
      baseEntries = [...filtered];
      baseEntries[newIdx] = entry;
    } else {
      baseEntries = [...prev.entries, entry];
    }

    // Track Task agent completion in progress tracker
    let updatedProgress = prev.taskAgentProgress;
    if (entry.toolName === 'Task' && entry.toolUseId) {
      updatedProgress = trackTaskAgentCompleted(
        { ...prev, taskAgentProgress: updatedProgress },
        entry.toolUseId,
      );
    }

    // Try batch merge for batchable tools (Read/Grep/Glob)
    const batchResult = tryMergeBatch(baseEntries, entry);
    if (batchResult) {
      return { ...prev, entries: batchResult, streamingText: '', taskAgentProgress: updatedProgress };
    }

    // Try task agents summary for consecutive Task tool_groups with stats
    if (entry.toolName === 'Task' && entry.toolStats) {
      // The new entry was already placed at some index, find it
      const newEntryIdx = baseEntries.findLastIndex(e => e === entry);
      if (newEntryIdx > 0) {
        const prevEntry = baseEntries[newEntryIdx - 1];

        if (prevEntry.kind === 'task_agents_summary' && prevEntry.childEntries) {
          // Extend existing summary
          const updated = [...baseEntries];
          updated[newEntryIdx - 1] = {
            ...prevEntry,
            childEntries: [...prevEntry.childEntries, entry],
            text: `${prevEntry.childEntries.length + 1} Task agents finished`,
            timestamp: entry.timestamp,
          };
          updated.splice(newEntryIdx, 1); // Remove the individual entry
          return { ...prev, entries: updated, streamingText: '', taskAgentProgress: updatedProgress };
        }

        if (prevEntry.kind === 'tool_group' && prevEntry.toolName === 'Task' && prevEntry.toolStats) {
          // Combine two Task tool_groups into a summary
          const updated = [...baseEntries];
          updated[newEntryIdx - 1] = {
            kind: 'task_agents_summary',
            text: '2 Task agents finished',
            timestamp: entry.timestamp,
            childEntries: [prevEntry, entry],
          };
          updated.splice(newEntryIdx, 1); // Remove the individual entry
          return { ...prev, entries: updated, streamingText: '', taskAgentProgress: updatedProgress };
        }
      }
    }

    return { ...prev, entries: baseEntries, streamingText: '', taskAgentProgress: updatedProgress };
  });
}
