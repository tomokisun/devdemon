import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { executeLoop, type LoopDependencies } from '../../../src/daemon/loop.js';
import { createTestRole } from '../../helpers/test-role-factory.js';
import { createTestTask } from '../../helpers/test-task-factory.js';
import type { AgentResult } from '../../../src/agent/agent.js';

function createMockAgent() {
  return {
    execute: mock(() =>
      Promise.resolve({
        success: true,
        result: 'Task completed successfully.',
        costUsd: 0.05,
        numTurns: 3,
        durationMs: 5000,
        errors: [],
      } satisfies AgentResult),
    ),
    interrupt: mock(() => Promise.resolve()),
    on: mock(() => {}),
    emit: mock(() => true),
  };
}

function createMockQueue(taskToReturn: ReturnType<typeof createTestTask> | null = null) {
  return {
    dequeue: mock(() => taskToReturn),
    enqueueUser: mock((instruction: string) =>
      createTestTask({ prompt: instruction, type: 'user' }),
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

function createDeps(overrides?: Partial<LoopDependencies>): LoopDependencies {
  return {
    agent: createMockAgent() as any,
    queue: createMockQueue() as any,
    state: createMockState() as any,
    role: createTestRole(),
    promptBuilder: createMockPromptBuilder() as any,
    ...overrides,
  };
}

describe('executeLoop', () => {
  describe('user task flow', () => {
    it('dequeues and executes a user task from the queue', async () => {
      const task = createTestTask({ type: 'user', prompt: 'Fix the bug' });
      const queue = createMockQueue(task);
      const agent = createMockAgent();
      const state = createMockState();
      const deps = createDeps({ queue: queue as any, agent: agent as any, state: state as any });

      const result = await executeLoop(deps);

      expect(queue.dequeue).toHaveBeenCalledTimes(1);
      expect(state.setCurrentTask).toHaveBeenCalledWith(task);
      expect(agent.execute).toHaveBeenCalledWith(task.prompt, deps.role);
      expect(state.recordCompletion).toHaveBeenCalledTimes(1);
      expect(result.task).toBe(task);
      expect(result.success).toBe(true);
    });

    it('records completion with the agent result', async () => {
      const task = createTestTask();
      const agentResult: AgentResult = {
        success: true,
        result: 'Done!',
        costUsd: 0.10,
        numTurns: 5,
        durationMs: 8000,
        errors: [],
      };
      const agent = createMockAgent();
      agent.execute = mock(() => Promise.resolve(agentResult));
      const state = createMockState();
      const deps = createDeps({
        queue: createMockQueue(task) as any,
        agent: agent as any,
        state: state as any,
      });

      await executeLoop(deps);

      expect(state.recordCompletion).toHaveBeenCalledWith(task, agentResult);
    });
  });

  describe('autonomous task flow', () => {
    it('generates autonomous task when queue is empty', async () => {
      const queue = createMockQueue(null);
      const promptBuilder = createMockPromptBuilder();
      const state = createMockState();
      const deps = createDeps({
        queue: queue as any,
        promptBuilder: promptBuilder as any,
        state: state as any,
      });

      const result = await executeLoop(deps);

      expect(queue.dequeue).toHaveBeenCalledTimes(1);
      expect(promptBuilder.buildAutonomous).toHaveBeenCalledTimes(1);
      expect(result.task.type).toBe('autonomous');
      expect(result.task.prompt).toBe('Autonomous task prompt');
      expect(result.task.priority).toBe(1);
      expect(result.success).toBe(true);
    });

    it('generates task with valid id and enqueuedAt', async () => {
      const deps = createDeps({ queue: createMockQueue(null) as any });

      const result = await executeLoop(deps);

      expect(result.task.id).toBeDefined();
      expect(result.task.id.length).toBeGreaterThan(0);
      expect(result.task.enqueuedAt).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('returns success=false when agent throws', async () => {
      const task = createTestTask();
      const agent = createMockAgent();
      agent.execute = mock(() => Promise.reject(new Error('Agent failed')));
      const state = createMockState();
      const deps = createDeps({
        queue: createMockQueue(task) as any,
        agent: agent as any,
        state: state as any,
      });

      const result = await executeLoop(deps);

      expect(result.success).toBe(false);
      expect(result.task).toBe(task);
    });

    it('records failure in state when agent throws', async () => {
      const task = createTestTask();
      const error = new Error('Agent crashed');
      const agent = createMockAgent();
      agent.execute = mock(() => Promise.reject(error));
      const state = createMockState();
      const deps = createDeps({
        queue: createMockQueue(task) as any,
        agent: agent as any,
        state: state as any,
      });

      await executeLoop(deps);

      expect(state.recordFailure).toHaveBeenCalledWith(task, error);
      expect(state.recordCompletion).not.toHaveBeenCalled();
    });

    it('never throws even when agent fails', async () => {
      const agent = createMockAgent();
      agent.execute = mock(() => Promise.reject(new Error('Boom')));
      const deps = createDeps({ agent: agent as any });

      // Should not throw
      const result = await executeLoop(deps);
      expect(result.success).toBe(false);
    });
  });
});
