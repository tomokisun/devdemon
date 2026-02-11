export interface Task {
  id: string;
  type: 'user' | 'autonomous';
  prompt: string;
  enqueuedAt: string;
  priority: number;
}

export function createTestTask(overrides?: Partial<Task>): Task {
  return {
    id: 'test-task-1',
    type: 'user',
    prompt: 'Fix the bug',
    enqueuedAt: new Date().toISOString(),
    priority: 0,
    ...overrides,
  };
}
