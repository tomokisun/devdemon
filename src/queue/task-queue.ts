import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { nanoid } from 'nanoid';
import type { Task } from './types.js';

export class TaskQueue {
  private queue: Task[] = [];
  private readonly persistPath: string;

  constructor(persistPath: string) {
    this.persistPath = persistPath;
    this.load();
  }

  enqueueUser(instruction: string): Task {
    const task: Task = {
      id: nanoid(),
      type: 'user',
      prompt: instruction,
      enqueuedAt: new Date().toISOString(),
      priority: 0,
    };
    this.queue.push(task);
    this.persist();
    return task;
  }

  enqueueAutonomous(prompt: string): Task {
    const task: Task = {
      id: nanoid(),
      type: 'autonomous',
      prompt,
      enqueuedAt: new Date().toISOString(),
      priority: 1,
    };
    // NOT added to queue - immediate return
    return task;
  }

  dequeue(): Task | null {
    if (this.queue.length === 0) return null;
    // Sort by priority (lowest number = highest priority), FIFO for same priority
    this.queue.sort((a, b) => a.priority - b.priority);
    const task = this.queue.shift()!;
    this.persist();
    return task;
  }

  peek(): Task | null {
    if (this.queue.length === 0) return null;
    this.queue.sort((a, b) => a.priority - b.priority);
    return this.queue[0];
  }

  get length(): number {
    return this.queue.length;
  }

  get userTaskCount(): number {
    return this.queue.filter((t) => t.type === 'user').length;
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      writeFileSync(this.persistPath, JSON.stringify(this.queue, null, 2));
    } catch {
      // Silently fail if unable to persist
    }
  }

  private load(): void {
    try {
      const data = readFileSync(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.queue = parsed;
      } else {
        this.queue = [];
      }
    } catch {
      // File missing or corrupt - start with empty queue
      this.queue = [];
    }
  }
}
