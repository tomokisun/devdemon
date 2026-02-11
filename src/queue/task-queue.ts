import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { nanoid } from 'nanoid';
import type { Task } from './types.js';
import { Logger } from '../utils/logger.js';

/** Default maximum number of tasks the queue will hold. */
const DEFAULT_MAX_QUEUE_SIZE = 1000;

export interface TaskQueueOptions {
  /** Maximum number of tasks allowed in the queue. Enqueue calls beyond this limit will throw. */
  maxQueueSize?: number;
}

export class TaskQueue {
  private queue: Task[] = [];
  private readonly persistPath: string;
  private readonly logger = new Logger();
  private readonly maxQueueSize: number;

  constructor(persistPath: string, options?: TaskQueueOptions) {
    this.persistPath = persistPath;
    this.maxQueueSize = options?.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.load();
  }

  enqueueUser(instruction: string): Task {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue is full (max ${this.maxQueueSize} tasks)`);
    }
    const task: Task = {
      id: nanoid(),
      type: 'user',
      prompt: instruction,
      enqueuedAt: new Date().toISOString(),
      priority: 0,
    };
    this.insertSorted(task);
    this.persist();
    return task;
  }

  /**
   * Creates an autonomous task object but does NOT add it to the queue.
   * This is a convenience factory method. Autonomous tasks are typically
   * generated on-the-fly when the queue is empty (see Daemon.generateAutonomousTask),
   * so they bypass the persistent queue entirely.
   */
  enqueueAutonomous(prompt: string): Task {
    const task: Task = {
      id: nanoid(),
      type: 'autonomous',
      prompt,
      enqueuedAt: new Date().toISOString(),
      priority: 1,
    };
    // NOT added to queue - this is a factory method that creates a task object
    // for immediate execution without persisting it to the queue.
    return task;
  }

  dequeue(): Task | null {
    if (this.queue.length === 0) return null;
    // Queue is maintained in sorted order (lowest priority number first, FIFO within same priority),
    // so the front element is always the highest-priority task.
    const task = this.queue.shift()!;
    this.persist();
    return task;
  }

  peek(): Task | null {
    if (this.queue.length === 0) return null;
    // Queue is maintained in sorted order, so index 0 is the highest-priority task.
    return this.queue[0];
  }

  get length(): number {
    return this.queue.length;
  }

  get userTaskCount(): number {
    return this.queue.filter((t) => t.type === 'user').length;
  }

  /**
   * Insert a task into the queue at the correct sorted position.
   * Uses binary search to find the insertion point, maintaining:
   *   - ascending priority order (lower number = higher priority)
   *   - FIFO order within the same priority (new tasks go after existing ones with the same priority)
   */
  private insertSorted(task: Task): void {
    let low = 0;
    let high = this.queue.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      // Use <= so that tasks with the same priority are inserted AFTER existing ones (FIFO)
      if (this.queue[mid].priority <= task.priority) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.queue.splice(low, 0, task);
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      writeFileSync(this.persistPath, JSON.stringify(this.queue, null, 2));
    } catch (error) {
      this.logger.error('Failed to persist task queue', { path: this.persistPath, error: String(error) });
    }
  }

  private load(): void {
    try {
      const data = readFileSync(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.queue = parsed;
        // Ensure loaded data is in sorted order (priority ascending, stable for FIFO).
        // This handles files written by older versions or manually edited files.
        this.queue.sort((a, b) => a.priority - b.priority);
      } else {
        this.queue = [];
      }
    } catch (error) {
      this.logger.warn('Failed to load task queue, starting with empty queue', { path: this.persistPath, error: String(error) });
      this.queue = [];
    }
  }
}
