import {
  MAX_VISIBLE_LINES,
  MAX_TOOL_RESULT_LENGTH,
  STREAM_THROTTLE_MS,
} from '../constants.js';
import { parseDiffFromEditInput, type DiffData } from '../ui/hooks/diff-parser.js';

// ---------------------------------------------------------------------------
// SDK Message shape definitions (for type-safe message handling)
// ---------------------------------------------------------------------------

// These interfaces describe the shapes of messages received from the Claude SDK.
// They use optional fields because the SDK may send partial data, and the
// handlers already guard against missing fields.

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown> | null;
  source?: unknown;
  tool_use_id?: string;
}

interface AssistantMessagePayload {
  type: 'assistant';
  parent_tool_use_id?: string | null;
  message?: {
    content?: ContentBlock[];
  };
}

interface StreamEventPayload {
  type: 'stream_event';
  parent_tool_use_id?: string | null;
  event?: {
    type?: string;
    delta?: {
      type?: string;
      text?: string;
    } | null;
    usage?: {
      output_tokens?: number;
    };
    message?: {
      usage?: {
        input_tokens?: number;
      };
    };
  };
}

interface ResultMessagePayload {
  type: 'result';
  subtype?: string;
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  errors?: string[];
}

interface SystemMessagePayload {
  type: 'system';
  parent_tool_use_id?: string | null;
  subtype?: string;
  session_id?: string;
  model?: string;
  tools?: string[];
  status?: string;
  message?: string;
  hook_name?: string;
}

interface ToolProgressPayload {
  type: 'tool_progress';
  parent_tool_use_id?: string | null;
  tool_name?: string;
  tool_use_id?: string;
  elapsed_time_seconds?: number;
}

interface ToolUseSummaryPayload {
  type: 'tool_use_summary';
  parent_tool_use_id?: string | null;
  tool_name?: string;
  tool_use_id?: string;
  summary?: string;
  result?: unknown;
}

interface ToolUseResultObject {
  content?: string | ContentBlock[];
  tool_name?: string;
  tool_use_id?: string;
  totalToolUseCount?: number;
  totalTokens?: number;
  totalDurationMs?: number;
}

interface UserMessagePayload {
  type: 'user';
  parent_tool_use_id?: string | null;
  tool_use_result?: string | ToolUseResultObject;
  tool_name?: string;
  tool_use_id?: string;
  message?: {
    content?: ContentBlock[];
  };
}

interface AuthStatusPayload {
  type: 'auth_status';
}

export type SDKMessagePayload =
  | AssistantMessagePayload
  | StreamEventPayload
  | ResultMessagePayload
  | SystemMessagePayload
  | ToolProgressPayload
  | ToolUseSummaryPayload
  | UserMessagePayload
  | AuthStatusPayload
  | { type: string };

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
  diffData?: DiffData;
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
  | { type: 'init'; sessionId: string; model: string; tools: string[] }
  | { type: 'token_update'; totalTokens: number };

// ---------------------------------------------------------------------------
// MessageStream
// ---------------------------------------------------------------------------

export class MessageStream {
  private streamBuffer: string = '';
  private lastStreamFlush: number = 0;
  private readonly streamThrottleMs = STREAM_THROTTLE_MS;
  private pendingToolUse: Map<string, LogEntry> = new Map();
  private _totalTokens: number = 0;

  /** Current cumulative output token count for the active cycle. */
  get totalTokens(): number {
    return this._totalTokens;
  }

  /** Reset the token counter (call at the start of each cycle). */
  resetTokens(): void {
    this._totalTokens = 0;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  processMessage(message: SDKMessagePayload): UIEvent | UIEvent[] | null {
    switch (message.type) {
      case 'assistant':
        return this.handleAssistant(message as AssistantMessagePayload);
      case 'stream_event':
        return this.handleStreamEvent(message as StreamEventPayload);
      case 'result':
        return this.handleResult(message as ResultMessagePayload);
      case 'system':
        return this.handleSystem(message as SystemMessagePayload);
      case 'tool_progress':
        return this.handleToolProgress(message as ToolProgressPayload);
      case 'tool_use_summary':
        return this.handleToolUseSummary(message as ToolUseSummaryPayload);
      case 'user':
        return this.handleUser(message as UserMessagePayload);
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

  private handleAssistant(message: AssistantMessagePayload): UIEvent[] | null {
    if (message.parent_tool_use_id) {
      return null;
    }

    const contentBlocks = message.message?.content;
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
        const toolName = block.name ?? '';
        const toolUseId = block.id ?? '';
        const entry: LogEntry = {
          kind: 'tool_use',
          text: this.formatToolCallTitle(toolName, block.input),
          timestamp: Date.now(),
          toolName,
          toolUseId,
          toolInput: block.input ?? {},
        };
        if (toolUseId) {
          this.pendingToolUse.set(toolUseId, entry);
        }
        events.push({ type: 'log', entry });
      }
    }

    return events.length > 0 ? events : null;
  }

  private handleStreamEvent(message: StreamEventPayload): UIEvent | UIEvent[] | null {
    if (message.parent_tool_use_id) {
      return null;
    }

    const event = message.event;

    // Track tokens from message_delta events (emitted at end of each message turn)
    if (event?.type === 'message_delta' && event.usage?.output_tokens) {
      this._totalTokens += event.usage.output_tokens;
      return { type: 'token_update', totalTokens: this._totalTokens };
    }

    // Track input tokens from message_start events
    if (event?.type === 'message_start' && event.message?.usage?.input_tokens) {
      this._totalTokens += event.message.usage.input_tokens;
      return { type: 'token_update', totalTokens: this._totalTokens };
    }

    if (
      event?.type !== 'content_block_delta' ||
      event.delta?.type !== 'text_delta'
    ) {
      return null;
    }

    const deltaText: string = event.delta.text ?? '';
    this.streamBuffer += deltaText;

    const now = Date.now();
    if (now - this.lastStreamFlush >= this.streamThrottleMs) {
      return this.flushStream();
    }

    return null;
  }

  private handleResult(message: ResultMessagePayload): UIEvent {
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

  private handleSystem(message: SystemMessagePayload): UIEvent | null {
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

  private handleToolProgress(message: ToolProgressPayload): UIEvent | null {
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

  private handleToolUseSummary(message: ToolUseSummaryPayload): UIEvent | null {
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

  private handleUser(message: UserMessagePayload): UIEvent | null {
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
          .filter((c: ContentBlock) => c.type === 'text')
          .map((c: ContentBlock) => c.text ?? '')
          .join('\n');
      } else {
        text = JSON.stringify(raw.content);
      }
    } else {
      text = JSON.stringify(raw);
    }

    if (text.length > MAX_TOOL_RESULT_LENGTH) {
      text = text.slice(0, MAX_TOOL_RESULT_LENGTH) + '...';
    }

    // Try to correlate with a pending tool_use to create a tool_group
    const content = message.message?.content;
    let toolUseId: string | undefined;
    if (Array.isArray(content)) {
      const toolResult = content.find((c: ContentBlock) => c.type === 'tool_result');
      toolUseId = toolResult?.tool_use_id;
    }

    if (toolUseId) {
      const pending = this.pendingToolUse.get(toolUseId);
      if (pending) {
        const allLines = text.split('\n');
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

        // Parse diff data for Edit tools
        let diffData: DiffData | undefined;
        if (pending.toolName === 'Edit' && pending.toolInput) {
          const parsed = parseDiffFromEditInput(pending.toolInput);
          if (parsed) {
            diffData = parsed;
          }
        }

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
            diffData,
            toolStats,
          },
        };
      }
    }

    const rawToolName = typeof raw === 'object' ? raw.tool_name : undefined;
    const rawToolUseId = typeof raw === 'object' ? raw.tool_use_id : undefined;

    return {
      type: 'log',
      entry: {
        kind: 'tool_result',
        text,
        timestamp: Date.now(),
        toolName: rawToolName ?? message.tool_name,
        toolUseId: rawToolUseId ?? message.tool_use_id,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private static readonly TOOL_FORMATTERS: Record<string, (obj: Record<string, unknown>, shortenPath: (p: string) => string) => string | null> = {
    'Task': (obj) => typeof obj.description === 'string' ? `Task(${obj.description})` : null,
    'Read': (obj, shortenPath) => typeof obj.file_path === 'string' ? `Read(${shortenPath(obj.file_path as string)})` : null,
    'Bash': (obj) => {
      if (typeof obj.command !== 'string') return null;
      const cmd = (obj.command as string).length > 60
        ? (obj.command as string).slice(0, 57) + '...'
        : obj.command as string;
      return `Bash(${cmd})`;
    },
    'Write': (obj, shortenPath) => typeof obj.file_path === 'string' ? `Write(${shortenPath(obj.file_path as string)})` : null,
    'Edit': (obj, shortenPath) => typeof obj.file_path === 'string' ? `Edit(${shortenPath(obj.file_path as string)})` : null,
    'Grep': (obj) => typeof obj.pattern === 'string' ? `Grep(${obj.pattern})` : null,
    'Glob': (obj) => typeof obj.pattern === 'string' ? `Glob(${obj.pattern})` : null,
  };

  private formatToolCallTitle(toolName: string, input: unknown): string {
    if (!input || typeof input !== 'object') return `${toolName} ${this.summarizeToolInput(input)}`;
    const obj = input as Record<string, unknown>;

    const formatter = MessageStream.TOOL_FORMATTERS[toolName];
    if (formatter) {
      const result = formatter(obj, this.shortenPath);
      if (result !== null) return result;
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
