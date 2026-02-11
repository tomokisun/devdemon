import { createInterface } from 'readline';
import type { RoleFrontmatter } from '../../roles/types.js';

export type RlFactory = () => ReturnType<typeof createInterface>;

export interface PromptRoleFrontmatterOptions {
  rlFactory?: RlFactory;
}

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

export async function promptRoleFrontmatter(
  options?: PromptRoleFrontmatterOptions,
): Promise<Omit<RoleFrontmatter, 'name'>> {
  const rl = options?.rlFactory
    ? options.rlFactory()
    : createInterface({ input: process.stdin, output: process.stdout });

  try {
    const descriptionRaw = await ask(rl, 'Description (optional): ');
    const description = descriptionRaw.trim() || undefined;

    const intervalRaw = await ask(rl, 'Interval in seconds (default: 300): ');
    let interval = 300;
    if (intervalRaw.trim() !== '') {
      const parsed = Number(intervalRaw.trim());
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error(`Invalid interval: "${intervalRaw.trim()}" must be a positive number`);
      }
      interval = parsed;
    }

    const maxTurnsRaw = await ask(rl, 'Max turns (default: 50): ');
    let maxTurns = 50;
    if (maxTurnsRaw.trim() !== '') {
      const parsed = Number(maxTurnsRaw.trim());
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error(`Invalid maxTurns: "${maxTurnsRaw.trim()}" must be a positive number`);
      }
      maxTurns = parsed;
    }

    const toolsRaw = await ask(rl, 'Tools (comma-separated): ');
    const tools = toolsRaw.trim()
      ? toolsRaw.trim().split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;

    const permissionModeRaw = await ask(rl, 'Permission mode (default/acceptEdits/bypassPermissions, default: acceptEdits): ');
    let permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' = 'acceptEdits';
    if (permissionModeRaw.trim() !== '') {
      const value = permissionModeRaw.trim();
      if (value !== 'default' && value !== 'acceptEdits' && value !== 'bypassPermissions') {
        throw new Error(`Invalid permissionMode: "${value}" must be one of default, acceptEdits, bypassPermissions`);
      }
      permissionMode = value;
    }

    const tagsRaw = await ask(rl, 'Tags (comma-separated, optional): ');
    const tags = tagsRaw.trim()
      ? tagsRaw.trim().split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;

    return {
      description,
      interval,
      maxTurns,
      tools,
      permissionMode,
      tags,
    };
  } finally {
    rl.close();
  }
}
