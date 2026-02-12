import type { AgentResult } from '../../agent/agent.js';
import type { UIEvent } from '../../agent/message-stream.js';

export interface PrintJsonOutput {
  result: string | null;
  session_id: string;
  role: string;
  is_error: boolean;
  cost_usd: number;
  num_turns: number;
  duration_ms: number;
  total_tokens: number;
}

export function formatTextOutput(result: AgentResult): string {
  if (result.success) {
    return result.result ?? '';
  }
  return result.errors.join('\n');
}

export function formatJsonOutput(
  result: AgentResult,
  sessionId: string,
  roleName: string,
  totalTokens: number,
): string {
  const output: PrintJsonOutput = {
    result: result.result,
    session_id: sessionId,
    role: roleName,
    is_error: !result.success,
    cost_usd: result.costUsd,
    num_turns: result.numTurns,
    duration_ms: result.durationMs,
    total_tokens: totalTokens,
  };
  return JSON.stringify(output, null, 2);
}

const STREAMED_LOG_KINDS = new Set([
  'assistant_text',
  'tool_use',
  'tool_group',
  'stream_text',
]);

export class StreamJsonWriter {
  private sessionId: string = '';
  private totalTokens: number = 0;

  writeEvent(event: UIEvent): void {
    switch (event.type) {
      case 'init':
        this.sessionId = event.sessionId;
        process.stdout.write(JSON.stringify(event) + '\n');
        break;

      case 'log':
        if (STREAMED_LOG_KINDS.has(event.entry.kind)) {
          process.stdout.write(JSON.stringify(event) + '\n');
        }
        break;

      case 'completion':
        process.stdout.write(JSON.stringify(event) + '\n');
        break;

      case 'error':
        process.stdout.write(JSON.stringify(event) + '\n');
        break;

      case 'token_update':
        this.totalTokens = event.totalTokens;
        break;
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }
}
