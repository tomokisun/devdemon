import matter from 'gray-matter';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve, extname } from 'path';
import { validateFrontmatter } from './validator.js';
import type { RoleConfig } from './types.js';

export function loadRole(filePath: string): RoleConfig {
  const absolutePath = resolve(filePath);
  const raw = readFileSync(absolutePath, 'utf-8');
  const { data, content } = matter(raw);
  const frontmatter = validateFrontmatter(data);
  return { frontmatter, body: content.trim(), filePath: absolutePath };
}

export function loadAllRoles(dirPath: string): RoleConfig[] {
  if (!existsSync(dirPath)) return [];
  const files = readdirSync(dirPath).filter(f => extname(f) === '.md');
  const roles: RoleConfig[] = [];
  for (const file of files) {
    try {
      roles.push(loadRole(join(dirPath, file)));
    } catch (error) {
      console.error(`Warning: Failed to load role ${file}:`, error instanceof Error ? error.message : error);
    }
  }
  return roles;
}

export function resolveRolesDir(options?: { rolesDir?: string }): string {
  if (options?.rolesDir) return resolve(options.rolesDir);
  const localRoles = resolve(process.cwd(), 'roles');
  if (existsSync(localRoles)) return localRoles;
  return resolve(import.meta.dir, '../../roles');
}
