// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export type LogEntryKind =
  | 'assistant_text'
  | 'tool_use'
  | 'tool_result'
  | 'tool_group'
  | 'tool_progress'
  | 'tool_use_summary'
  | 'tool_batch'
  | 'thinking_time'
  | 'task_agents_summary'
  | 'system_init'
  | 'system_status'
  | 'system_hook'
  | 'stream_text'
  | 'result_success'
  | 'result_error'
  | 'compact_boundary'
  | 'cycle_separator'
  | 'user_task';

export interface LogEntry {
  kind: LogEntryKind;
  text: string;
  timestamp: number;
  toolName?: string;
  toolUseId?: string;
  toolInput?: Record<string, unknown>;
  resultLines?: string[];
  batchedTools?: Array<{ toolName: string; count: number }>;
  childEntries?: LogEntry[];
  totalResultLines?: number;
  toolStats?: {
    totalToolUseCount?: number;
    totalTokens?: number;
    totalDurationMs?: number;
  };
}

export type UIEvent =
  | { type: 'log'; entry: LogEntry }
  | { type: 'completion'; result: string; costUsd: number; durationMs: number; numTurns: number }
  | { type: 'error'; errors: string[] }
  | { type: 'init'; sessionId: string; model: string; tools: string[] };

// ---------------------------------------------------------------------------
// MessageStream
// ---------------------------------------------------------------------------

export class MessageStream {
  private streamBuffer: string = '';
  private lastStreamFlush: number = 0;
  private readonly STREAM_THROTTLE_MS = 100;
  private pendingToolUse: Map<string, LogEntry> = new Map();

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  processMessage(message: any): UIEvent | UIEvent[] | null {
    switch (message.type) {
      case 'assistant':
        return this.handleAssistant(message);
      case 'stream_event':
        return this.handleStreamEvent(message);
      case 'result':
        return this.handleResult(message);
      case 'system':
        return this.handleSystem(message);
      case 'tool_progress':
        return this.handleToolProgress(message);
      case 'tool_use_summary':
        return this.handleToolUseSummary(message);
      case 'user':
        return this.handleUser(message);
      case 'auth_status':
        return null;
      default:
        return null;
    }
  }

  flushStream(): UIEvent | null {
    if (this.streamBuffer.length === 0) {
      return null;
    }

    const text = this.streamBuffer;
    this.streamBuffer = '';
    this.lastStreamFlush = Date.now();

    return {
      type: 'log',
      entry: {
        kind: 'stream_text',
        text,
        timestamp: Date.now(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Private message-type handlers
  // -------------------------------------------------------------------------

  private handleAssistant(message: any): UIEvent[] | null {
    if (message.parent_tool_use_id) {
      return null;
    }

    const contentBlocks: any[] = message.message?.content;
    if (!Array.isArray(contentBlocks) || contentBlocks.length === 0) {
      return null;
    }

    const events: UIEvent[] = [];

    for (const block of contentBlocks) {
      if (block.type === 'text') {
        events.push({
          type: 'log',
          entry: {
            kind: 'assistant_text',
            text: block.text ?? '',
            timestamp: Date.now(),
          },
        });
      } else if (block.type === 'tool_use') {
        const entry: LogEntry = {
          kind: 'tool_use',
          text: this.formatToolCallTitle(block.name, block.input),
          timestamp: Date.now(),
          toolName: block.name,
          toolUseId: block.id,
          toolInput: block.input ?? {},
        };
        this.pendingToolUse.set(block.id, entry);
        events.push({ type: 'log', entry });
      }
    }

    return events.length > 0 ? events : null;
  }

  private handleStreamEvent(message: any): UIEvent | null {
    if (message.parent_tool_use_id) {
      return null;
    }

    const event = message.event;
    if (
      event?.type !== 'content_block_delta' ||
      event.delta?.type !== 'text_delta'
    ) {
      return null;
    }

    const deltaText: string = event.delta.text ?? '';
    this.streamBuffer += deltaText;

    const now = Date.now();
    if (now - this.lastStreamFlush >= this.STREAM_THROTTLE_MS) {
      return this.flushStream();
    }

    return null;
  }

  private handleResult(message: any): UIEvent {
    if (message.subtype === 'success') {
      return {
        type: 'completion',
        result: message.result ?? '',
        costUsd: message.total_cost_usd ?? 0,
        durationMs: message.duration_ms ?? 0,
        numTurns: message.num_turns ?? 0,
      };
    }

    return {
      type: 'error',
      errors: message.errors ?? ['Unknown error'],
    };
  }

  private handleSystem(message: any): UIEvent | null {
    if (message.parent_tool_use_id) {
      return null;
    }

    switch (message.subtype) {
      case 'init':
        return {
          type: 'init',
          sessionId: message.session_id ?? '',
          model: message.model ?? '',
          tools: message.tools ?? [],
        };

      case 'status':
        return {
          type: 'log',
          entry: {
            kind: 'system_status',
            text: message.status ?? message.message ?? 'Status changed',
            timestamp: Date.now(),
          },
        };

      case 'hook_started':
      case 'hook_progress':
      case 'hook_response':
        return {
          type: 'log',
          entry: {
            kind: 'system_hook',
            text: message.message ?? message.hook_name ?? `Hook ${message.subtype}`,
            timestamp: Date.now(),
          },
        };

      case 'compact_boundary':
        return {
          type: 'log',
          entry: {
            kind: 'compact_boundary',
            text: 'Context compacted',
            timestamp: Date.now(),
          },
        };

      default:
        return null;
    }
  }

  private handleToolProgress(message: any): UIEvent | null {
    if (message.parent_tool_use_id) {
      return null;
    }

    return {
      type: 'log',
      entry: {
        kind: 'tool_progress',
        text: `${message.tool_name} running (${message.elapsed_time_seconds}s)`,
        timestamp: Date.now(),
        toolName: message.tool_name,
        toolUseId: message.tool_use_id,
      },
    };
  }

  private handleToolUseSummary(message: any): UIEvent | null {
    if (message.parent_tool_use_id) {
      return null;
    }

    const parts: string[] = [];

    if (message.tool_name) {
      parts.push(message.tool_name);
    }
    if (message.summary) {
      parts.push(message.summary);
    } else if (message.result) {
      parts.push(typeof message.result === 'string' ? message.result : JSON.stringify(message.result));
    }

    return {
      type: 'log',
      entry: {
        kind: 'tool_use_summary',
        text: parts.join(': ') || 'Tool use summary',
        timestamp: Date.now(),
        toolName: message.tool_name,
        toolUseId: message.tool_use_id,
      },
    };
  }

  private handleUser(message: any): UIEvent | null {
    if (message.parent_tool_use_id) {
      return null;
    }

    if (!message.tool_use_result) {
      return null;
    }

    const raw = message.tool_use_result;
    let text: string;

    if (typeof raw === 'string') {
      text = raw;
    } else if (raw.content) {
      if (typeof raw.content === 'string') {
        text = raw.content;
      } else if (Array.isArray(raw.content)) {
        text = raw.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text ?? '')
          .join('\n');
      } else {
        text = JSON.stringify(raw.content);
      }
    } else {
      text = JSON.stringify(raw);
    }

    if (text.length > 500) {
      text = text.slice(0, 500) + '...';
    }

    // Try to correlate with a pending tool_use to create a tool_group
    const content = message.message?.content;
    let toolUseId: string | undefined;
    if (Array.isArray(content)) {
      const toolResult = content.find((c: any) => c.type === 'tool_result');
      toolUseId = toolResult?.tool_use_id;
    }

    if (toolUseId) {
      const pending = this.pendingToolUse.get(toolUseId);
      if (pending) {
        const allLines = text.split('\n');
        const MAX_VISIBLE_LINES = 5;
        const resultLines = allLines.slice(0, MAX_VISIBLE_LINES);
        const totalResultLines = allLines.length;
        if (allLines.length > MAX_VISIBLE_LINES) {
          resultLines.push(`... +${allLines.length - MAX_VISIBLE_LINES} lines`);
        }

        // Extract sub-agent stats if present
        let toolStats: LogEntry['toolStats'];
        if (raw && typeof raw === 'object') {
          const hasStats =
            raw.totalToolUseCount !== undefined ||
            raw.totalTokens !== undefined ||
            raw.totalDurationMs !== undefined;
          if (hasStats) {
            toolStats = {
              totalToolUseCount: raw.totalToolUseCount,
              totalTokens: raw.totalTokens,
              totalDurationMs: raw.totalDurationMs,
            };
          }
        }

        this.pendingToolUse.delete(toolUseId);

        return {
          type: 'log',
          entry: {
            kind: 'tool_group',
            text: pending.text,
            timestamp: Date.now(),
            toolName: pending.toolName,
            toolUseId: pending.toolUseId,
            toolInput: pending.toolInput,
            resultLines,
            totalResultLines,
            toolStats,
          },
        };
      }
    }

    return {
      type: 'log',
      entry: {
        kind: 'tool_result',
        text,
        timestamp: Date.now(),
        toolName: raw.tool_name ?? message.tool_name,
        toolUseId: raw.tool_use_id ?? message.tool_use_id,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private formatToolCallTitle(toolName: string, input: unknown): string {
    if (!input || typeof input !== 'object') return `${toolName} ${this.summarizeToolInput(input)}`;
    const obj = input as Record<string, unknown>;

    if (toolName === 'Task' && typeof obj.description === 'string') {
      return `Task(${obj.description})`;
    }
    if (toolName === 'Read' && typeof obj.file_path === 'string') {
      return `Read(${this.shortenPath(obj.file_path as string)})`;
    }
    if (toolName === 'Bash' && typeof obj.command === 'string') {
      const cmd = (obj.command as string).length > 60
        ? (obj.command as string).slice(0, 57) + '...'
        : obj.command as string;
      return `Bash(${cmd})`;
    }
    if ((toolName === 'Write' || toolName === 'Edit') && typeof obj.file_path === 'string') {
      return `${toolName}(${this.shortenPath(obj.file_path as string)})`;
    }
    if (toolName === 'Grep' && typeof obj.pattern === 'string') {
      return `Grep(${obj.pattern})`;
    }
    if (toolName === 'Glob' && typeof obj.pattern === 'string') {
      return `Glob(${obj.pattern})`;
    }
    return `${toolName} ${this.summarizeToolInput(input)}`;
  }

  private shortenPath(fullPath: string): string {
    const parts = fullPath.split('/');
    if (parts.length <= 3) return fullPath;
    return parts.slice(-3).join('/');
  }

  private summarizeToolInput(input: unknown): string {
    if (input === undefined || input === null) {
      return '';
    }

    const json = JSON.stringify(input);
    if (json.length <= 80) {
      return json;
    }

    return json.slice(0, 80) + '...';
  }
}
