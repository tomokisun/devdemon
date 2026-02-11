import { readFileSync } from 'fs';
import { EventEmitter } from 'events';
import { ensureDevDemonDir, getStatePath, getQueuePath } from '../../utils/paths.js';
import type { RoleConfig } from '../../roles/types.js';
import type { DevDemonStats } from '../../state/types.js';
import type { SettingsStore } from '../../settings/store.js';
import type { Daemon } from '../../daemon/daemon.js';

export function loadPreviousStats(statePath: string): DevDemonStats | null {
  try {
    const data = readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed && parsed.version === 1 && parsed.stats) {
      return parsed.stats as DevDemonStats;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Creates a minimal mock daemon for dry-run mode.
 * Satisfies the Daemon interface shape used by the UI layer without
 * actually connecting to the Claude SDK.
 */
export function createDryRunDaemon(role: RoleConfig, repoPath: string): Daemon {
  const emitter = new EventEmitter();
  const queue = { length: 0 };

  const daemon: Daemon = Object.assign(emitter, {
    agent: new EventEmitter(),
    role,
    repoPath,
    queue,
    state: {
      getStats: (): DevDemonStats => ({
        totalCycles: 0, totalCostUsd: 0, totalTasks: 0,
        userTasks: 0, autonomousTasks: 0, failedTasks: 0,
      }),
      save: () => {},
    },
    enqueueUserTask: (_instruction: string) => {
      queue.length++;
    },
    stop: async () => {},
    start: async () => {},
    isRunning: () => false,
  }) as Daemon;

  return daemon;
}

export async function createDaemon(
  role: RoleConfig,
  repoPath: string,
  settingsStore: SettingsStore,
) {
  const devdemonDir = ensureDevDemonDir(repoPath);
  const statePath = getStatePath(repoPath);
  const queuePath = getQueuePath(repoPath);

  const previousStats = loadPreviousStats(statePath);

  const { StateStore } = await import('../../state/store.js');
  const { TaskQueue } = await import('../../queue/task-queue.js');
  const { ProgressTracker } = await import('../../agent/progress-tracker.js');
  const { Agent } = await import('../../agent/agent.js');
  const { PromptBuilder } = await import('../../agent/prompt-builder.js');
  const { Daemon } = await import('../../daemon/daemon.js');

  const state = new StateStore(statePath, repoPath);
  const queue = new TaskQueue(queuePath);
  const progressTracker = new ProgressTracker(devdemonDir);
  const agent = new Agent(repoPath, settingsStore.get());
  const promptBuilder = new PromptBuilder(role, state, progressTracker);

  const daemon = new Daemon({
    role,
    repoPath,
    agent,
    queue,
    state,
    promptBuilder,
  });

  return { daemon, previousStats };
}
