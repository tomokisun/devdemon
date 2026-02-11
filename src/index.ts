// DevDemon - Autonomous AI Agent Daemon
export { Agent } from './agent/agent.js';
export type { AgentResult } from './agent/agent.js';
export { PromptBuilder } from './agent/prompt-builder.js';
export type { StateStoreReader } from './agent/prompt-builder.js';
export { ProgressTracker } from './agent/progress-tracker.js';
export { MessageStream } from './agent/message-stream.js';
export type { UIEvent, LogEntry, LogEntryKind } from './agent/message-stream.js';

export { TaskQueue } from './queue/task-queue.js';
export type { Task } from './queue/types.js';

export { StateStore } from './state/store.js';
export type {
  DevDemonState,
  DevDemonStats,
  TaskHistoryEntry,
  CurrentTask,
} from './state/types.js';

export { Daemon } from './daemon/daemon.js';
export type { DaemonConfig } from './daemon/daemon.js';
export { executeLoop } from './daemon/loop.js';
export type { LoopDependencies, LoopResult } from './daemon/loop.js';

export { SettingsStore } from './settings/store.js';
export type { DevDemonSettings } from './settings/types.js';
