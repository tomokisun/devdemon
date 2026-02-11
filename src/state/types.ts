export interface TaskHistoryEntry {
  id: string;
  type: 'user' | 'autonomous';
  prompt: string;
  result: string | null;
  status: 'completed' | 'failed' | 'interrupted';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  costUsd: number;
  numTurns: number;
}

export interface DevDemonStats {
  totalCycles: number;
  totalCostUsd: number;
  totalTasks: number;
  userTasks: number;
  autonomousTasks: number;
  failedTasks: number;
}

export interface CurrentTask {
  id: string;
  type: 'user' | 'autonomous';
  prompt: string;
  startedAt: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
}

export interface DevDemonState {
  version: 1;
  sessionId: string;
  startedAt: string;
  currentRole: { name: string; file: string };
  currentTask: CurrentTask | null;
  taskHistory: TaskHistoryEntry[];
  stats: DevDemonStats;
}
