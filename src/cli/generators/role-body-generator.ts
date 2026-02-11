import { query } from '@anthropic-ai/claude-agent-sdk';
import type { RoleFrontmatter } from '../../roles/types.js';
import type { DevDemonSettings } from '../../settings/types.js';

export interface GenerateRoleBodyOptions {
  frontmatter: RoleFrontmatter;
  settings?: DevDemonSettings;
}

export function buildPrompt(fm: RoleFrontmatter): string {
  const lines: string[] = [
    `Generate a Markdown body for a DevDemon role called "${fm.name}".`,
  ];

  if (fm.description) {
    lines.push(`Description: ${fm.description}`);
  }
  if (fm.tools && fm.tools.length > 0) {
    lines.push(`Allowed tools: ${fm.tools.join(', ')}`);
  }
  if (fm.tags && fm.tags.length > 0) {
    lines.push(`Tags: ${fm.tags.join(', ')}`);
  }
  lines.push(`Interval: ${fm.interval}s, Max turns: ${fm.maxTurns}, Permission mode: ${fm.permissionMode}`);
  lines.push('');
  lines.push('Return ONLY the Markdown body (no frontmatter, no code fences). The body should describe the role\'s responsibilities, guidelines, and constraints for a Claude Code agent.');

  return lines.join('\n');
}

export function FALLBACK_BODY(name: string): string {
  return [
    `You are the **${name}** role.`,
    '',
    '## Responsibilities',
    '',
    '- Carry out tasks assigned to this role',
    '- Follow project conventions and best practices',
    '- Report progress clearly',
    '',
    '## Guidelines',
    '',
    '- Be thorough and precise',
    '- Ask for clarification when requirements are ambiguous',
    '- Prefer minimal, focused changes',
  ].join('\n');
}

export async function generateRoleBody(options: GenerateRoleBodyOptions): Promise<string> {
  const { frontmatter } = options;
  const prompt = buildPrompt(frontmatter);

  try {
    const conversation = query({
      prompt,
      options: {
        maxTurns: 1,
        allowedTools: [],
        ...(options.settings?.model ? { model: options.settings.model } : {}),
      },
    });

    let resultText: string | null = null;

    for await (const message of conversation) {
      if (message.type === 'result' && message.subtype === 'success') {
        resultText = message.result ?? null;
      }
    }

    if (resultText !== null) {
      return resultText.trim();
    }

    console.warn(`Role body generation returned no result for "${frontmatter.name}", using fallback.`);
    return FALLBACK_BODY(frontmatter.name);
  } catch (error) {
    console.warn(`Role body generation failed for "${frontmatter.name}", using fallback.`, error);
    return FALLBACK_BODY(frontmatter.name);
  }
}
