import { EventEmitter } from 'events';
import { query } from '@anthropic-ai/claude-agent-sdk';
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
    let result: any = null;

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
        ...(this.settings.model ? { model: this.settings.model } : {}),
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: role.body + claudeMdInstruction + languageInstruction,
        },
        allowedTools: role.frontmatter.tools,
        permissionMode: role.frontmatter.permissionMode,
        maxTurns: role.frontmatter.maxTurns,
        model: 'claude-opus-4-20250514',
        includePartialMessages: true,
        executable: 'bun',
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

    return {
      success: result?.subtype === 'success',
      result: result?.subtype === 'success' ? result.result : null,
      costUsd: result?.total_cost_usd ?? 0,
      numTurns: result?.num_turns ?? 0,
      durationMs: Date.now() - startTime,
      errors: result?.subtype === 'error' ? result.errors : [],
    };
  }

  async interrupt(): Promise<void> {
    if (this.currentQuery) {
      await this.currentQuery.interrupt();
      this.currentQuery = null;
    }
  }
}
