import { createInterface } from 'readline';
import { z } from 'zod';
import { IntervalSchema, MaxTurnsSchema, PermissionModeSchema } from '../../roles/types.js';
import type { RoleFrontmatter } from '../../roles/types.js';

export type RlFactory = () => ReturnType<typeof createInterface>;

export interface PromptRoleFrontmatterOptions {
  rlFactory?: RlFactory;
}

const DEFAULT_INTERVAL = 300;
const DEFAULT_MAX_TURNS = 50;
const DEFAULT_PERMISSION_MODE: RoleFrontmatter['permissionMode'] = 'acceptEdits';

function createRl(rlFactory?: RlFactory): ReturnType<typeof createInterface> {
  return rlFactory
    ? rlFactory()
    : createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function parseInterval(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return DEFAULT_INTERVAL;
  const num = Number(trimmed);
  if (isNaN(num)) {
    throw new Error(`Invalid interval: "${trimmed}" must be a positive number`);
  }
  try {
    return IntervalSchema.parse(num);
  } catch {
    throw new Error(`Invalid interval: "${trimmed}" must be a positive number`);
  }
}

function parseMaxTurns(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return DEFAULT_MAX_TURNS;
  const num = Number(trimmed);
  if (isNaN(num)) {
    throw new Error(`Invalid maxTurns: "${trimmed}" must be a positive number`);
  }
  try {
    return MaxTurnsSchema.parse(num);
  } catch {
    throw new Error(`Invalid maxTurns: "${trimmed}" must be a positive number`);
  }
}

function parsePermissionMode(raw: string): RoleFrontmatter['permissionMode'] {
  const trimmed = raw.trim();
  if (trimmed === '') return DEFAULT_PERMISSION_MODE;
  try {
    return PermissionModeSchema.parse(trimmed);
  } catch {
    throw new Error(`Invalid permissionMode: "${trimmed}" must be one of default, acceptEdits, bypassPermissions`);
  }
}

export async function promptRoleFrontmatter(
  options?: PromptRoleFrontmatterOptions,
): Promise<Omit<RoleFrontmatter, 'name'>> {
  const rl = createRl(options?.rlFactory);

  try {
    const descriptionRaw = await ask(rl, 'Description (optional): ');
    const description = descriptionRaw.trim() || undefined;

    const intervalRaw = await ask(rl, `Interval in seconds (default: ${DEFAULT_INTERVAL}): `);
    const interval = parseInterval(intervalRaw);

    const maxTurnsRaw = await ask(rl, `Max turns (default: ${DEFAULT_MAX_TURNS}): `);
    const maxTurns = parseMaxTurns(maxTurnsRaw);

    const toolsRaw = await ask(rl, 'Tools (comma-separated): ');
    const tools = toolsRaw.trim()
      ? toolsRaw.trim().split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;

    const permissionModeRaw = await ask(rl, `Permission mode (default/acceptEdits/bypassPermissions, default: ${DEFAULT_PERMISSION_MODE}): `);
    const permissionMode = parsePermissionMode(permissionModeRaw);

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
