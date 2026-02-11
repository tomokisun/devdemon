import { EventEmitter } from 'events';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import type { RoleConfig } from '../roles/types.js';
import type { DevDemonSettings } from '../settings/types.js';
import { loadClaudeMd } from './claude-md-loader.js';
import type { ClaudeMdOptions } from './claude-md-loader.js';

export interface AgentResult {
  success: boolean;
  result: string | null;
  costUsd: number;
  numTurns: number;
  durationMs: number;
  errors: string[];
}

const DEFAULT_MODEL = 'claude-opus-4-20250514';
const DEFAULT_EXECUTABLE = 'bun';

export class Agent extends EventEmitter {
  private currentQuery: ReturnType<typeof query> | null = null;
  private repoPath: string;
  private settings: DevDemonSettings;
  private claudeMdOptions?: ClaudeMdOptions;

  constructor(repoPath: string, settings?: DevDemonSettings, claudeMdOptions?: ClaudeMdOptions) {
    super();
    this.repoPath = repoPath;
    this.settings = settings ?? {};
    this.claudeMdOptions = claudeMdOptions;
  }

  async execute(prompt: string, role: RoleConfig): Promise<AgentResult> {
    const startTime = Date.now();
    let result: SDKResultMessage | null = null;

    const languageInstruction = this.settings.language
      ? `\n\nIMPORTANT: Always respond in ${this.settings.language}. Use ${this.settings.language} for all explanations, comments, and communications.`
      : '';

    const claudeMd = loadClaudeMd(this.repoPath, this.claudeMdOptions);
    const claudeMdInstruction = claudeMd.content
      ? `\n\n## CLAUDE.md Instructions\n\n${claudeMd.content}`
      : '';

    this.currentQuery = query({
      prompt,
      options: {
        cwd: this.repoPath,
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: role.body + claudeMdInstruction + languageInstruction,
        },
        allowedTools: role.frontmatter.tools,
        permissionMode: role.frontmatter.permissionMode,
        maxTurns: role.frontmatter.maxTurns,
        model: this.settings.model ?? DEFAULT_MODEL,
        includePartialMessages: true,
        executable: (this.settings.executable ?? DEFAULT_EXECUTABLE) as 'bun' | 'deno' | 'node',
        effort: 'high',
        thinking: {
          type: 'adaptive',
        },
      },
    });

    for await (const message of this.currentQuery) {
      this.emit('message', message);
      if (message.type === 'result') {
        result = message;
      }
    }

    const durationMs = Date.now() - startTime;
    if (result?.subtype === 'success') {
      return {
        success: true,
        result: result.result,
        costUsd: result.total_cost_usd,
        numTurns: result.num_turns,
        durationMs,
        errors: [],
      };
    }
    return {
      success: false,
      result: null,
      costUsd: result?.total_cost_usd ?? 0,
      numTurns: result?.num_turns ?? 0,
      durationMs,
      errors: result?.errors ?? [],
    };
  }

  async interrupt(): Promise<void> {
    if (this.currentQuery) {
      await this.currentQuery.interrupt();
      this.currentQuery = null;
    }
  }
}
