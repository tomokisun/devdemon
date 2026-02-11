import matter from 'gray-matter';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { validateRoleName } from './validator.js';
import type { RoleFrontmatter } from './types.js';

export interface WriteRoleOptions {
  rolesDir: string;
  frontmatter: RoleFrontmatter;
  body: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function writeRole(options: WriteRoleOptions): string {
  const { rolesDir, frontmatter, body } = options;
  const dir = resolve(rolesDir);

  // Validate role name before writing
  validateRoleName(frontmatter.name);

  mkdirSync(dir, { recursive: true });

  const slug = slugify(frontmatter.name);
  const filename = `${slug}.md`;
  const filePath = join(dir, filename);

  if (existsSync(filePath)) {
    throw new Error(`Role file already exists: ${filePath}`);
  }

  const { name, interval, maxTurns, tools, permissionMode, description, tags } = frontmatter;
  const fm: Record<string, unknown> = { name, interval, maxTurns };
  if (tools) fm.tools = tools;
  fm.permissionMode = permissionMode;
  if (description) fm.description = description;
  if (tags) fm.tags = tags;

  const content = matter.stringify(body.endsWith('\n') ? body : body + '\n', fm);
  writeFileSync(filePath, content, 'utf-8');

  return filePath;
}
