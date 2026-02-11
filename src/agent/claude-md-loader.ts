import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { DEVDEMON_DIR_NAME } from '../constants.js';

export interface ClaudeMdResult {
  content: string;
  loadedPaths: string[];
}

export interface ClaudeMdOptions {
  globalConfigDir?: string;
}

const MAX_DEPTH = 4;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  DEVDEMON_DIR_NAME,
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  '.turbo',
]);

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function findSubdirClaudeMdFiles(basePath: string, currentDepth: number): string[] {
  if (currentDepth >= MAX_DEPTH) return [];

  let entries: string[];
  try {
    entries = readdirSync(basePath);
  } catch {
    return [];
  }

  const results: string[] = [];

  const sorted = entries.slice().sort();
  for (const entry of sorted) {
    if (SKIP_DIRS.has(entry)) continue;

    const fullPath = join(basePath, entry);
    try {
      const stat = statSync(fullPath);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const claudeMdPath = join(fullPath, 'CLAUDE.md');
    if (readFileSafe(claudeMdPath) !== null) {
      results.push(claudeMdPath);
    }

    results.push(...findSubdirClaudeMdFiles(fullPath, currentDepth + 1));
  }

  return results;
}

export function loadClaudeMd(repoPath: string, options?: ClaudeMdOptions): ClaudeMdResult {
  const globalConfigDir = options?.globalConfigDir ?? join(homedir(), '.claude');
  const absoluteRepoPath = resolve(repoPath);

  const candidates: string[] = [
    join(globalConfigDir, 'CLAUDE.md'),
    join(absoluteRepoPath, 'CLAUDE.md'),
    ...findSubdirClaudeMdFiles(absoluteRepoPath, 0),
  ];

  const loadedPaths: string[] = [];
  const contents: string[] = [];

  for (const filePath of candidates) {
    const text = readFileSafe(filePath);
    if (text !== null) {
      loadedPaths.push(filePath);
      contents.push(text);
    }
  }

  return {
    content: contents.join('\n\n'),
    loadedPaths,
  };
}
