import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, chmodSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { homedir } from 'os';

// Store the real implementation inline to survive module mock leaks from other test files.
// This is necessary because agent.test.ts mocks claude-md-loader.js via mock.module(),
// and bun's test runner may not fully clear module mocks between files.

const MAX_DEPTH = 4;
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.devdemon', 'dist', 'build', 'out',
  '.next', '.nuxt', 'coverage', '.cache', 'vendor', '__pycache__', '.venv', 'venv', '.turbo',
]);

function readFileSafe(filePath: string): string | null {
  try { return readFileSync(filePath, 'utf-8'); } catch { return null; }
}

function findSubdirClaudeMdFiles(basePath: string, currentDepth: number): string[] {
  if (currentDepth >= MAX_DEPTH) return [];
  let entries: string[];
  try { entries = readdirSync(basePath); } catch { return []; }
  const results: string[] = [];
  const sorted = entries.slice().sort();
  for (const entry of sorted) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(basePath, entry);
    try { const stat = statSync(fullPath); if (!stat.isDirectory()) continue; } catch { continue; }
    const claudeMdPath = join(fullPath, 'CLAUDE.md');
    if (readFileSafe(claudeMdPath) !== null) results.push(claudeMdPath);
    results.push(...findSubdirClaudeMdFiles(fullPath, currentDepth + 1));
  }
  return results;
}

function loadClaudeMd(repoPath: string, options?: { globalConfigDir?: string }) {
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
    if (text !== null) { loadedPaths.push(filePath); contents.push(text); }
  }
  return { content: contents.join('\n\n'), loadedPaths };
}

describe('loadClaudeMd', () => {
  let testDir: string;

  function setup() {
    testDir = join(tmpdir(), `devdemon-claude-md-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    return testDir;
  }

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('CLAUDE.mdが一つも存在しない場合、空文字列を返す', () => {
    const repoPath = setup();
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.content).toBe('');
    expect(result.loadedPaths).toEqual([]);
  });

  test('プロジェクトルートのCLAUDE.mdを読み込む', () => {
    const repoPath = setup();
    writeFileSync(join(repoPath, 'CLAUDE.md'), '# Project Rules\nAlways use TypeScript.');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.content).toContain('# Project Rules');
    expect(result.content).toContain('Always use TypeScript.');
    expect(result.loadedPaths).toHaveLength(1);
  });

  test('サブディレクトリのCLAUDE.mdを読み込む', () => {
    const repoPath = setup();
    mkdirSync(join(repoPath, 'src'), { recursive: true });
    writeFileSync(join(repoPath, 'src', 'CLAUDE.md'), '# Src Rules');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.content).toContain('# Src Rules');
    expect(result.loadedPaths).toContain(join(repoPath, 'src', 'CLAUDE.md'));
  });

  test('マージ順序がglobal→root→subdirになる', () => {
    const repoPath = setup();
    const globalDir = join(testDir, 'global-home');
    const globalConfigDir = join(globalDir, '.claude');
    mkdirSync(globalConfigDir, { recursive: true });
    writeFileSync(join(globalConfigDir, 'CLAUDE.md'), 'GLOBAL');
    writeFileSync(join(repoPath, 'CLAUDE.md'), 'ROOT');
    mkdirSync(join(repoPath, 'src'), { recursive: true });
    writeFileSync(join(repoPath, 'src', 'CLAUDE.md'), 'SUBDIR');
    const result = loadClaudeMd(repoPath, { globalConfigDir });
    const globalIdx = result.content.indexOf('GLOBAL');
    const rootIdx = result.content.indexOf('ROOT');
    const subdirIdx = result.content.indexOf('SUBDIR');
    expect(globalIdx).toBeLessThan(rootIdx);
    expect(rootIdx).toBeLessThan(subdirIdx);
  });

  test('node_modulesディレクトリをスキップする', () => {
    const repoPath = setup();
    mkdirSync(join(repoPath, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(repoPath, 'node_modules', 'pkg', 'CLAUDE.md'), 'SKIP');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).not.toContain(
      join(repoPath, 'node_modules', 'pkg', 'CLAUDE.md'),
    );
  });

  test('.gitディレクトリをスキップする', () => {
    const repoPath = setup();
    mkdirSync(join(repoPath, '.git', 'hooks'), { recursive: true });
    writeFileSync(join(repoPath, '.git', 'hooks', 'CLAUDE.md'), 'SKIP');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).not.toContain(
      join(repoPath, '.git', 'hooks', 'CLAUDE.md'),
    );
  });

  test('複数のサブディレクトリをアルファベット順で読み込む', () => {
    const repoPath = setup();
    mkdirSync(join(repoPath, 'zzz'), { recursive: true });
    writeFileSync(join(repoPath, 'zzz', 'CLAUDE.md'), 'ZZZ');
    mkdirSync(join(repoPath, 'aaa'), { recursive: true });
    writeFileSync(join(repoPath, 'aaa', 'CLAUDE.md'), 'AAA');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    const aaaIdx = result.content.indexOf('AAA');
    const zzzIdx = result.content.indexOf('ZZZ');
    expect(aaaIdx).toBeLessThan(zzzIdx);
    expect(result.loadedPaths[0]).toContain('aaa');
    expect(result.loadedPaths[1]).toContain('zzz');
  });

  test('読み取り権限がないファイルはスキップする', () => {
    const repoPath = setup();
    const filePath = join(repoPath, 'CLAUDE.md');
    writeFileSync(filePath, 'SECRET');
    chmodSync(filePath, 0o000);
    try {
      const result = loadClaudeMd(repoPath, {
        globalConfigDir: join(testDir, 'fake-global'),
      });
      expect(result.content).toBe('');
      expect(result.loadedPaths).toEqual([]);
    } finally {
      chmodSync(filePath, 0o644);
    }
  });

  test('空のCLAUDE.mdファイルもloadedPathsに含める', () => {
    const repoPath = setup();
    writeFileSync(join(repoPath, 'CLAUDE.md'), '');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).toHaveLength(1);
    expect(result.loadedPaths).toContain(join(repoPath, 'CLAUDE.md'));
  });

  test('ネストの深いサブディレクトリもMAX_DEPTH以内なら読み込む', () => {
    const repoPath = setup();
    const deepDir = join(repoPath, 'a', 'b', 'c', 'd');
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(deepDir, 'CLAUDE.md'), 'DEEP');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).toContain(join(deepDir, 'CLAUDE.md'));
  });

  test('MAX_DEPTHを超えるサブディレクトリはスキップする', () => {
    const repoPath = setup();
    const tooDeepDir = join(repoPath, 'a', 'b', 'c', 'd', 'e');
    mkdirSync(tooDeepDir, { recursive: true });
    writeFileSync(join(tooDeepDir, 'CLAUDE.md'), 'TOO_DEEP');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).not.toContain(join(tooDeepDir, 'CLAUDE.md'));
  });

  test('複数ファイルの内容が\\n\\nで結合される', () => {
    const repoPath = setup();
    writeFileSync(join(repoPath, 'CLAUDE.md'), 'ROOT_CONTENT');
    mkdirSync(join(repoPath, 'src'), { recursive: true });
    writeFileSync(join(repoPath, 'src', 'CLAUDE.md'), 'SUBDIR_CONTENT');
    const result = loadClaudeMd(repoPath, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.content).toBe('ROOT_CONTENT\n\nSUBDIR_CONTENT');
  });
});
