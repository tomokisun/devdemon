import type { RoleConfig } from '../roles/types.js';
import type { ProgressTracker } from './progress-tracker.js';
import { RECENT_HISTORY_COUNT, MAX_HISTORY_PROMPT_LENGTH } from '../constants.js';

export interface StateStoreReader {
  getRepoPath(): string;
  getRecentHistory(count: number): Array<{ status: string; prompt: string }>;
  getStats(): { totalCycles: number };
}

export class PromptBuilder {
  constructor(
    private role: RoleConfig,
    private state: StateStoreReader,
    private progressTracker: ProgressTracker,
  ) {}

  buildUser(instruction: string): string {
    const context = this.buildContext();
    return `${context}\n\n## User Instruction\n\n${instruction}`;
  }

  buildAutonomous(): string {
    const context = this.buildContext();
    const recentHistory = this.state.getRecentHistory(RECENT_HISTORY_COUNT);
    const historyText =
      recentHistory.length > 0
        ? recentHistory.map((t) => `- [${t.status}] ${t.prompt.slice(0, MAX_HISTORY_PROMPT_LENGTH)}`).join('\n')
        : 'No previous tasks.';
    const progress = this.progressTracker.read();

    return [
      context,
      '## Recent Task History',
      historyText,
      progress ? `## Progress Notes\n${progress}` : '',
      '## Your Task',
      'Based on your role definition, recent history, and progress notes,',
      'decide what to do next. Choose a task that provides value',
      'and does not duplicate recent work.',
      '',
      '## Important Guidelines',
      '- Before starting, run existing tests to understand current state',
      '- After completing work, run tests again to ensure no regressions',
      '- If you try an approach that fails, update .devdemon/progress.md',
      '  with what you tried and why it failed, so future cycles avoid it',
      '- Keep output concise. Log details to files, not stdout',
      '- Commit your changes with clear commit messages',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildContext(): string {
    return [
      `## Context`,
      `- Repository: ${this.state.getRepoPath()}`,
      `- Role: ${this.role.frontmatter.name}`,
      `- Cycle: #${this.state.getStats().totalCycles + 1}`,
      `- Time: ${new Date().toISOString()}`,
    ].join('\n');
  }
}
