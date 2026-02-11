import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import type { Agent } from '../agent/agent.js';
import type { PromptBuilder } from '../agent/prompt-builder.js';
import type { TaskQueue } from '../queue/task-queue.js';
import type { Task } from '../queue/types.js';
import type { RoleConfig } from '../roles/types.js';
import type { StateStore } from '../state/store.js';

export interface DaemonConfig {
  role: RoleConfig;
  repoPath: string;
  agent: Agent;
  queue: TaskQueue;
  state: StateStore;
  promptBuilder: PromptBuilder;
  maxConsecutiveErrors?: number;
  baseBackoffMs?: number;
}

export class Daemon extends EventEmitter {
  public role: RoleConfig;
  public repoPath: string;
  public agent: Agent;
  public queue: TaskQueue;
  public state: StateStore;
  private promptBuilder: PromptBuilder;
  private running: boolean = false;
  private currentCycleAbort: AbortController | null = null;
  private consecutiveErrors: number = 0;
  private readonly maxConsecutiveErrors: number;
  private readonly baseBackoffMs: number;
  private static readonly MAX_BACKOFF_MS = 60_000;

  constructor(config: DaemonConfig) {
    super();
    this.role = config.role;
    this.repoPath = config.repoPath;
    this.agent = config.agent;
    this.queue = config.queue;
    this.state = config.state;
    this.promptBuilder = config.promptBuilder;
    this.maxConsecutiveErrors = config.maxConsecutiveErrors ?? 5;
    this.baseBackoffMs = config.baseBackoffMs ?? 5000;
  }

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    this.running = true;
    this.emit('started', { role: this.role, repoPath: this.repoPath });

    while (this.running) {
      await this.executeCycle();
      if (this.running) {
        await this.wait(this.role.frontmatter.interval);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.currentCycleAbort?.abort();
    await this.agent.interrupt();
    this.state.save();
    this.emit('stopped');
  }

  enqueueUserTask(instruction: string): Task {
    const task = this.queue.enqueueUser(instruction);
    this.emit('task-enqueued', task);
    return task;
  }

  private async executeCycle(): Promise<void> {
    const task = this.queue.dequeue() ?? this.generateAutonomousTask();
    this.state.setCurrentTask(task);
    this.emit('cycle-start', task);

    try {
      const result = await this.agent.execute(task.prompt, this.role);
      this.consecutiveErrors = 0;
      this.state.recordCompletion(task, result);
      this.emit('cycle-complete', { task, result });
    } catch (error) {
      this.consecutiveErrors++;
      this.state.recordFailure(task, error);
      this.emit('cycle-error', { task, error });

      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        this.emit('max-errors-reached', this.consecutiveErrors);
      }

      if (this.running) {
        const backoffMs = Math.min(
          this.baseBackoffMs * this.consecutiveErrors,
          Daemon.MAX_BACKOFF_MS,
        );
        await this.wait(backoffMs / 1000);
      }
    }
  }

  private generateAutonomousTask(): Task {
    const prompt = this.promptBuilder.buildAutonomous();
    return {
      id: nanoid(),
      type: 'autonomous',
      prompt,
      enqueuedAt: new Date().toISOString(),
      priority: 1,
    };
  }

  private wait(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, seconds * 1000);
      this.currentCycleAbort = new AbortController();
      this.currentCycleAbort.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
