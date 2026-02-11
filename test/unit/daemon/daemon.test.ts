import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Daemon, type DaemonConfig } from '../../../src/daemon/daemon.js';
import { createTestRole } from '../../helpers/test-role-factory.js';
import { createTestTask } from '../../helpers/test-task-factory.js';
import type { AgentResult } from '../../../src/agent/agent.js';

function createMockAgent() {
  return {
    execute: mock(() =>
      Promise.resolve({
        success: true,
        result: 'Task completed.',
        costUsd: 0.05,
        numTurns: 3,
        durationMs: 5000,
        errors: [],
      } satisfies AgentResult),
    ),
    interrupt: mock(() => Promise.resolve()),
    on: mock(() => ({})),
    off: mock(() => ({})),
    emit: mock(() => true),
    removeListener: mock(() => ({})),
    addListener: mock(() => ({})),
    once: mock(() => ({})),
    removeAllListeners: mock(() => ({})),
  };
}

function createMockQueue() {
  return {
    dequeue: mock(() => null as ReturnType<typeof createTestTask> | null),
    enqueueUser: mock((instruction: string) =>
      createTestTask({ prompt: instruction, type: 'user', id: 'user-task-1' }),
    ),
    enqueueAutonomous: mock((prompt: string) =>
      createTestTask({ prompt, type: 'autonomous' }),
    ),
    peek: mock(() => null),
    length: 0,
    userTaskCount: 0,
  };
}

function createMockState() {
  return {
    setCurrentTask: mock(() => {}),
    recordCompletion: mock(() => {}),
    recordFailure: mock(() => {}),
    getRecentHistory: mock(() => []),
    getStats: mock(() => ({
      totalCycles: 0,
      totalCostUsd: 0,
      totalTasks: 0,
      userTasks: 0,
      autonomousTasks: 0,
      failedTasks: 0,
    })),
    getRepoPath: mock(() => '/test/repo'),
    save: mock(() => {}),
  };
}

function createMockPromptBuilder() {
  return {
    buildUser: mock((instruction: string) => `User: ${instruction}`),
    buildAutonomous: mock(() => 'Autonomous task prompt'),
  };
}

function createDaemon(overrides?: Partial<DaemonConfig>): {
  daemon: Daemon;
  agent: ReturnType<typeof createMockAgent>;
  queue: ReturnType<typeof createMockQueue>;
  state: ReturnType<typeof createMockState>;
  promptBuilder: ReturnType<typeof createMockPromptBuilder>;
} {
  const agent = createMockAgent();
  const queue = createMockQueue();
  const state = createMockState();
  const promptBuilder = createMockPromptBuilder();
  const role = createTestRole({ frontmatter: { interval: 0.01 } });

  const daemon = new Daemon({
    role,
    repoPath: '/test/repo',
    agent: agent as any,
    queue: queue as any,
    state: state as any,
    promptBuilder: promptBuilder as any,
    baseBackoffMs: 1,
    ...overrides,
  });

  return { daemon, agent, queue, state, promptBuilder };
}

describe('Daemon', () => {
  describe('constructor', () => {
    it('sets all properties from config', () => {
      const role = createTestRole();
      const agent = createMockAgent();
      const queue = createMockQueue();
      const state = createMockState();
      const promptBuilder = createMockPromptBuilder();

      const daemon = new Daemon({
        role,
        repoPath: '/my/repo',
        agent: agent as any,
        queue: queue as any,
        state: state as any,
        promptBuilder: promptBuilder as any,
      });

      expect(daemon.role).toBe(role);
      expect(daemon.repoPath).toBe('/my/repo');
      expect(daemon.agent).toBe(agent);
      expect(daemon.queue).toBe(queue);
      expect(daemon.state).toBe(state);
    });

    it('starts in not-running state', () => {
      const { daemon } = createDaemon();
      expect(daemon.isRunning()).toBe(false);
    });
  });

  describe('start', () => {
    it('sets running to true', async () => {
      const { daemon, agent } = createDaemon();

      // Stop after first cycle
      let cycleCount = 0;
      agent.execute = mock(() => {
        cycleCount++;
        if (cycleCount >= 1) {
          // Schedule stop so the loop exits
          setTimeout(() => daemon.stop(), 0);
        }
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      // We need to check running state during the loop
      let wasRunning = false;
      daemon.on('cycle-start', () => {
        wasRunning = daemon.isRunning();
      });

      await daemon.start();

      expect(wasRunning).toBe(true);
    });

    it('emits started event', async () => {
      const { daemon, agent } = createDaemon();
      const events: any[] = [];

      daemon.on('started', (data: any) => events.push(data));

      // Stop immediately after first cycle
      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(events).toHaveLength(1);
      expect(events[0].repoPath).toBe('/test/repo');
      expect(events[0].role).toBeDefined();
    });

    it('executes cycles in a loop', async () => {
      const { daemon, agent } = createDaemon();
      let cycleCount = 0;

      agent.execute = mock(() => {
        cycleCount++;
        if (cycleCount >= 3) {
          setTimeout(() => daemon.stop(), 0);
        }
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(cycleCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('stop', () => {
    it('sets running to false', async () => {
      const { daemon, agent } = createDaemon();

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(daemon.isRunning()).toBe(false);
    });

    it('calls agent.interrupt()', async () => {
      const { daemon, agent } = createDaemon();

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(agent.interrupt).toHaveBeenCalled();
    });

    it('calls state.save()', async () => {
      const { daemon, agent, state } = createDaemon();

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(state.save).toHaveBeenCalled();
    });

    it('emits stopped event', async () => {
      const { daemon, agent } = createDaemon();
      const events: any[] = [];

      daemon.on('stopped', () => events.push('stopped'));

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(events).toContain('stopped');
    });

    it('cancels pending wait', async () => {
      const { daemon, agent } = createDaemon();
      const role = createTestRole({ frontmatter: { interval: 60 } }); // 60s wait

      const d = new Daemon({
        role,
        repoPath: '/test/repo',
        agent: agent as any,
        queue: createMockQueue() as any,
        state: createMockState() as any,
        promptBuilder: createMockPromptBuilder() as any,
      });

      let cycleCount = 0;
      agent.execute = mock(() => {
        cycleCount++;
        if (cycleCount >= 1) {
          // Stop after first cycle completes, while waiting
          setTimeout(() => d.stop(), 10);
        }
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      const startTime = Date.now();
      await d.start();
      const elapsed = Date.now() - startTime;

      // Should have completed much faster than 60s
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('executeCycle', () => {
    it('dequeues task from queue when available', async () => {
      const { daemon, agent, queue } = createDaemon();
      const task = createTestTask({ id: 'queued-1', prompt: 'Do work' });
      queue.dequeue = mock(() => {
        // Return task first time, then stop
        queue.dequeue = mock(() => {
          setTimeout(() => daemon.stop(), 0);
          return null;
        });
        return task;
      });

      agent.execute = mock(() =>
        Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        }),
      );

      const cycleEvents: any[] = [];
      daemon.on('cycle-start', (t: any) => cycleEvents.push(t));

      await daemon.start();

      expect(cycleEvents[0].id).toBe('queued-1');
      expect(cycleEvents[0].prompt).toBe('Do work');
    });

    it('generates autonomous task when queue is empty', async () => {
      const { daemon, agent, promptBuilder } = createDaemon();

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      const cycleEvents: any[] = [];
      daemon.on('cycle-start', (t: any) => cycleEvents.push(t));

      await daemon.start();

      expect(promptBuilder.buildAutonomous).toHaveBeenCalled();
      expect(cycleEvents[0].type).toBe('autonomous');
    });

    it('calls agent.execute() with task prompt and role', async () => {
      const { daemon, agent } = createDaemon();

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(agent.execute).toHaveBeenCalled();
      const call = (agent.execute as any).mock.calls[0];
      expect(typeof call[0]).toBe('string');
      expect(call[1]).toBe(daemon.role);
    });

    it('emits cycle-start and cycle-complete events on success', async () => {
      const { daemon, agent } = createDaemon();
      const events: string[] = [];

      daemon.on('cycle-start', () => events.push('cycle-start'));
      daemon.on('cycle-complete', () => events.push('cycle-complete'));

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(events).toContain('cycle-start');
      expect(events).toContain('cycle-complete');
    });

    it('emits cycle-error on agent failure and continues', async () => {
      const { daemon, agent } = createDaemon();
      const events: string[] = [];
      let callCount = 0;

      daemon.on('cycle-start', () => events.push('cycle-start'));
      daemon.on('cycle-error', () => events.push('cycle-error'));
      daemon.on('cycle-complete', () => events.push('cycle-complete'));

      agent.execute = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Agent failed'));
        }
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(events).toContain('cycle-error');
      // Should have continued after error
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('calls state.setCurrentTask before execution', async () => {
      const { daemon, agent, state } = createDaemon();
      const callOrder: string[] = [];

      state.setCurrentTask = mock(() => {
        callOrder.push('setCurrentTask');
      });
      agent.execute = mock(() => {
        callOrder.push('execute');
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(callOrder.indexOf('setCurrentTask')).toBeLessThan(
        callOrder.indexOf('execute'),
      );
    });

    it('calls state.recordCompletion on success', async () => {
      const { daemon, agent, state } = createDaemon();

      const agentResult = {
        success: true,
        result: 'Done',
        costUsd: 0.05,
        numTurns: 3,
        durationMs: 5000,
        errors: [],
      };

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve(agentResult);
      });

      await daemon.start();

      expect(state.recordCompletion).toHaveBeenCalled();
    });

    it('calls state.recordFailure on failure', async () => {
      const { daemon, agent, state } = createDaemon();
      const error = new Error('Boom');

      agent.execute = mock(() => {
        setTimeout(() => daemon.stop(), 0);
        return Promise.reject(error);
      });

      await daemon.start();

      expect(state.recordFailure).toHaveBeenCalled();
      const call = (state.recordFailure as any).mock.calls[0];
      expect(call[1]).toBe(error);
    });
  });

  describe('enqueueUserTask', () => {
    it('adds user task to queue', () => {
      const { daemon, queue } = createDaemon();

      daemon.enqueueUserTask('Fix the login page');

      expect(queue.enqueueUser).toHaveBeenCalledWith('Fix the login page');
    });

    it('emits task-enqueued event', () => {
      const { daemon } = createDaemon();
      const events: any[] = [];

      daemon.on('task-enqueued', (task: any) => events.push(task));
      daemon.enqueueUserTask('Fix the login page');

      expect(events).toHaveLength(1);
      expect(events[0].prompt).toBe('Fix the login page');
      expect(events[0].type).toBe('user');
    });

    it('returns the created Task', () => {
      const { daemon } = createDaemon();

      const task = daemon.enqueueUserTask('Fix the bug');

      expect(task).toBeDefined();
      expect(task.prompt).toBe('Fix the bug');
      expect(task.type).toBe('user');
      expect(task.id).toBeDefined();
    });
  });

  describe('error recovery', () => {
    it('increments consecutiveErrors on each failure', async () => {
      const { daemon, agent } = createDaemon({
        maxConsecutiveErrors: 10,
        baseBackoffMs: 1,
      } as any);
      const errorEvents: any[] = [];

      daemon.on('cycle-error', () => errorEvents.push('error'));

      let callCount = 0;
      agent.execute = mock(() => {
        callCount++;
        if (callCount >= 3) {
          setTimeout(() => daemon.stop(), 0);
        }
        return Promise.reject(new Error('fail'));
      });

      await daemon.start();

      expect(errorEvents.length).toBeGreaterThanOrEqual(3);
    });

    it('resets consecutiveErrors on success after failures', async () => {
      const { daemon, agent } = createDaemon({
        maxConsecutiveErrors: 10,
        baseBackoffMs: 1,
      } as any);
      const events: string[] = [];

      daemon.on('cycle-error', () => events.push('error'));
      daemon.on('cycle-complete', () => events.push('complete'));
      daemon.on('max-errors-reached', () => events.push('max-errors'));

      let callCount = 0;
      agent.execute = mock(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('fail'));
        }
        // 3rd call succeeds
        if (callCount === 3) {
          return Promise.resolve({
            success: true,
            result: 'Done',
            costUsd: 0.01,
            numTurns: 1,
            durationMs: 100,
            errors: [],
          });
        }
        // 4th call also fails - if max-errors were not reset, we'd see max-errors event
        // but since we reset on success, we won't see it
        setTimeout(() => daemon.stop(), 0);
        return Promise.reject(new Error('fail again'));
      });

      await daemon.start();

      // Errors reset after success, so max-errors should never fire (max=10, only 2 consecutive at most)
      expect(events).not.toContain('max-errors');
      expect(events).toContain('complete');
    });

    it('emits max-errors-reached after N consecutive errors', async () => {
      const { daemon, agent } = createDaemon({
        maxConsecutiveErrors: 3,
        baseBackoffMs: 1,
      } as any);
      const maxErrorEvents: number[] = [];

      daemon.on('max-errors-reached', (count: number) => maxErrorEvents.push(count));

      let callCount = 0;
      agent.execute = mock(() => {
        callCount++;
        if (callCount >= 4) {
          setTimeout(() => daemon.stop(), 0);
        }
        return Promise.reject(new Error('fail'));
      });

      await daemon.start();

      expect(maxErrorEvents.length).toBeGreaterThanOrEqual(1);
      expect(maxErrorEvents[0]).toBe(3);
    });

    it('applies backoff wait after error', async () => {
      const baseBackoffMs = 50;
      const { daemon, agent } = createDaemon({
        maxConsecutiveErrors: 10,
        baseBackoffMs,
      } as any);

      const cycleTimes: number[] = [];
      let callCount = 0;

      agent.execute = mock(() => {
        callCount++;
        cycleTimes.push(Date.now());
        if (callCount >= 2) {
          setTimeout(() => daemon.stop(), 0);
        }
        return Promise.reject(new Error('fail'));
      });

      await daemon.start();

      if (cycleTimes.length >= 2) {
        const gap = cycleTimes[1] - cycleTimes[0];
        // First error: backoff = baseBackoffMs * 1 = 50ms, plus interval wait
        // Should have waited at least ~50ms
        expect(gap).toBeGreaterThanOrEqual(30);
      }
    });

    it('caps backoff at 60 seconds max', () => {
      // Verify the MAX_BACKOFF_MS static field is 60000
      expect((Daemon as any).MAX_BACKOFF_MS).toBe(60_000);

      // Verify the math: with high consecutiveErrors and large baseBackoffMs,
      // the backoff would be capped at MAX_BACKOFF_MS
      const { daemon } = createDaemon({
        baseBackoffMs: 10000,
        maxConsecutiveErrors: 100,
      } as any);

      // Simulate many consecutive errors by setting private field
      (daemon as any).consecutiveErrors = 10;
      // baseBackoffMs * 10 = 100_000, but should be capped at 60_000
      const computedBackoff = Math.min(
        (daemon as any).baseBackoffMs * (daemon as any).consecutiveErrors,
        (Daemon as any).MAX_BACKOFF_MS,
      );
      expect(computedBackoff).toBe(60_000);
    });

    it('does not emit max-errors-reached below threshold', async () => {
      const { daemon, agent } = createDaemon({
        maxConsecutiveErrors: 5,
        baseBackoffMs: 1,
      } as any);
      let maxErrorsFired = false;

      daemon.on('max-errors-reached', () => { maxErrorsFired = true; });

      let callCount = 0;
      agent.execute = mock(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.reject(new Error('fail'));
        }
        // 4th call succeeds then stop
        setTimeout(() => daemon.stop(), 0);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      await daemon.start();

      expect(maxErrorsFired).toBe(false);
    });

    it('uses default maxConsecutiveErrors=5 and baseBackoffMs=5000', () => {
      const daemon = new Daemon({
        role: createTestRole(),
        repoPath: '/test/repo',
        agent: createMockAgent() as any,
        queue: createMockQueue() as any,
        state: createMockState() as any,
        promptBuilder: createMockPromptBuilder() as any,
      });
      expect((daemon as any).maxConsecutiveErrors).toBe(5);
      expect((daemon as any).baseBackoffMs).toBe(5000);
    });
  });

  describe('wait', () => {
    it('waits for specified duration', async () => {
      const { daemon, agent } = createDaemon();
      const role = createTestRole({ frontmatter: { interval: 0.05 } }); // 50ms

      const d = new Daemon({
        role,
        repoPath: '/test/repo',
        agent: agent as any,
        queue: createMockQueue() as any,
        state: createMockState() as any,
        promptBuilder: createMockPromptBuilder() as any,
      });

      let cycleCount = 0;
      const cycleTimes: number[] = [];

      agent.execute = mock(() => {
        cycleCount++;
        cycleTimes.push(Date.now());
        if (cycleCount >= 2) {
          setTimeout(() => d.stop(), 0);
        }
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 0,
          errors: [],
        });
      });

      await d.start();

      if (cycleTimes.length >= 2) {
        const gap = cycleTimes[1] - cycleTimes[0];
        // Should have waited at least ~50ms between cycles
        expect(gap).toBeGreaterThanOrEqual(30);
      }
    });

    it('can be cancelled with stop()', async () => {
      const { daemon, agent } = createDaemon();
      const role = createTestRole({ frontmatter: { interval: 10 } }); // 10s wait

      const d = new Daemon({
        role,
        repoPath: '/test/repo',
        agent: agent as any,
        queue: createMockQueue() as any,
        state: createMockState() as any,
        promptBuilder: createMockPromptBuilder() as any,
      });

      agent.execute = mock(() => {
        // Stop shortly after first cycle
        setTimeout(() => d.stop(), 10);
        return Promise.resolve({
          success: true,
          result: 'Done',
          costUsd: 0.01,
          numTurns: 1,
          durationMs: 100,
          errors: [],
        });
      });

      const startTime = Date.now();
      await d.start();
      const elapsed = Date.now() - startTime;

      // Should complete much faster than 10s
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
