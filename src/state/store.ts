import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { nanoid } from 'nanoid';
import type { DevDemonState, DevDemonStats, TaskHistoryEntry, CurrentTask } from './types.js';
import { Logger } from '../utils/logger.js';

export class StateStore {
  private state: DevDemonState;
  private readonly filePath: string;
  private readonly repoPath: string;
  private readonly logger = new Logger();

  constructor(filePath: string, repoPath: string) {
    this.filePath = filePath;
    this.repoPath = repoPath;
    this.state = this.load();
  }

  setCurrentTask(task: { id: string; type: 'user' | 'autonomous'; prompt: string }): void {
    this.state.currentTask = {
      id: task.id,
      type: task.type,
      prompt: task.prompt,
      startedAt: new Date().toISOString(),
      status: 'running',
    };
    this.save();
  }

  recordCompletion(
    task: { id: string; type: 'user' | 'autonomous'; prompt: string },
    result: { result: string | null; costUsd: number; numTurns: number; durationMs: number; success: boolean },
  ): void {
    const entry: TaskHistoryEntry = {
      id: task.id,
      type: task.type,
      prompt: task.prompt,
      result: result.result ?? '',
      status: 'completed',
      startedAt: this.state.currentTask?.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      costUsd: result.costUsd,
      numTurns: result.numTurns,
    };
    this.state.taskHistory.push(entry);
    this.state.currentTask = null;
    this.updateStats(entry);
    this.save();
  }

  recordFailure(task: { id: string; type: 'user' | 'autonomous'; prompt: string }, error: unknown): void {
    const entry: TaskHistoryEntry = {
      id: task.id,
      type: task.type,
      prompt: task.prompt,
      result: error instanceof Error ? error.message : String(error),
      status: 'failed',
      startedAt: this.state.currentTask?.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      costUsd: 0,
      numTurns: 0,
    };
    this.state.taskHistory.push(entry);
    this.state.currentTask = null;
    this.state.stats.failedTasks += 1;
    this.updateStats(entry);
    this.save();
  }

  getRecentHistory(count: number): TaskHistoryEntry[] {
    return this.state.taskHistory.slice(-count);
  }

  getStats(): DevDemonStats {
    return { ...this.state.stats };
  }

  getRepoPath(): string {
    return this.repoPath;
  }

  save(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      this.logger.error('Failed to save state', { path: this.filePath, error: String(error) });
    }
  }

  private load(): DevDemonState {
    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && parsed.version === 1) {
        return parsed as DevDemonState;
      }
      return this.createDefaultState();
    } catch (error) {
      this.logger.warn('Failed to load state, using defaults', { path: this.filePath, error: String(error) });
      return this.createDefaultState();
    }
  }

  private updateStats(entry: TaskHistoryEntry): void {
    this.state.stats.totalCycles += 1;
    this.state.stats.totalCostUsd += entry.costUsd;
    this.state.stats.totalTasks += 1;
    if (entry.type === 'user') {
      this.state.stats.userTasks += 1;
    } else {
      this.state.stats.autonomousTasks += 1;
    }
  }

  private createDefaultState(): DevDemonState {
    return {
      version: 1,
      sessionId: nanoid(),
      startedAt: new Date().toISOString(),
      currentRole: { name: '', file: '' },
      currentTask: null,
      taskHistory: [],
      stats: {
        totalCycles: 0,
        totalCostUsd: 0,
        totalTasks: 0,
        userTasks: 0,
        autonomousTasks: 0,
        failedTasks: 0,
      },
    };
  }
}
