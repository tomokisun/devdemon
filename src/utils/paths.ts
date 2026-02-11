import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export function getDevDemonDir(repoPath?: string): string {
  return join(repoPath ?? process.cwd(), '.devdemon');
}

export function getStatePath(repoPath?: string): string {
  return join(getDevDemonDir(repoPath), 'state.json');
}

export function getQueuePath(repoPath?: string): string {
  return join(getDevDemonDir(repoPath), 'queue.json');
}

export function getLogPath(repoPath?: string): string {
  return join(getDevDemonDir(repoPath), 'debug.log');
}

export function ensureDevDemonDir(repoPath?: string): string {
  const dir = getDevDemonDir(repoPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}
