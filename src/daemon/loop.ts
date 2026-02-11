import { nanoid } from 'nanoid';
import type { Agent } from '../agent/agent.js';
import type { PromptBuilder } from '../agent/prompt-builder.js';
import type { TaskQueue } from '../queue/task-queue.js';
import type { Task } from '../queue/types.js';
import type { RoleConfig } from '../roles/types.js';
import type { StateStore } from '../state/store.js';

export interface LoopDependencies {
  agent: Agent;
  queue: TaskQueue;
  state: StateStore;
  role: RoleConfig;
  promptBuilder: PromptBuilder;
}

export interface LoopResult {
  task: Task;
  success: boolean;
}

export async function executeLoop(deps: LoopDependencies): Promise<LoopResult> {
  const task = deps.queue.dequeue() ?? generateAutonomousTask(deps);
  deps.state.setCurrentTask(task);

  try {
    const result = await deps.agent.execute(task.prompt, deps.role);
    deps.state.recordCompletion(task, result);
    return { task, success: true };
  } catch (error) {
    deps.state.recordFailure(task, error);
    return { task, success: false };
  }
}

function generateAutonomousTask(deps: LoopDependencies): Task {
  const prompt = deps.promptBuilder.buildAutonomous();
  return {
    id: nanoid(),
    type: 'autonomous',
    prompt,
    enqueuedAt: new Date().toISOString(),
    priority: 1,
  };
}
