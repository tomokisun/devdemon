import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { loadClaudeMd } from '../../../src/agent/claude-md-loader.js';

describe('loadClaudeMd', () => {
  let testDir: string;

  beforeEach(() => {
    mock.restore();
  });

  function setup(): string {
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
    const testDir = setup();
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.content).toBe('');
    expect(result.loadedPaths).toEqual([]);
  });

  test('プロジェクトルートのCLAUDE.mdを読み込む', () => {
    const testDir = setup();
    writeFileSync(join(testDir, 'CLAUDE.md'), '# Project Rules\nAlways use TypeScript.');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.content).toContain('# Project Rules');
    expect(result.content).toContain('Always use TypeScript.');
    expect(result.loadedPaths).toHaveLength(1);
  });

  test('サブディレクトリのCLAUDE.mdを読み込む', () => {
    const testDir = setup();
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'CLAUDE.md'), '# Src Rules');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.content).toContain('# Src Rules');
    expect(result.loadedPaths).toContain(join(testDir, 'src', 'CLAUDE.md'));
  });

  test('マージ順序がglobal→root→subdirになる', () => {
    const testDir = setup();
    const globalDir = join(testDir, 'global-home');
    const globalConfigDir = join(globalDir, '.claude');
    mkdirSync(globalConfigDir, { recursive: true });
    writeFileSync(join(globalConfigDir, 'CLAUDE.md'), 'GLOBAL');
    writeFileSync(join(testDir, 'CLAUDE.md'), 'ROOT');
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'CLAUDE.md'), 'SUBDIR');
    const result = loadClaudeMd(testDir, { globalConfigDir });
    const globalIdx = result.content.indexOf('GLOBAL');
    const rootIdx = result.content.indexOf('ROOT');
    const subdirIdx = result.content.indexOf('SUBDIR');
    expect(globalIdx).toBeLessThan(rootIdx);
    expect(rootIdx).toBeLessThan(subdirIdx);
  });

  test('node_modulesディレクトリをスキップする', () => {
    const testDir = setup();
    mkdirSync(join(testDir, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(testDir, 'node_modules', 'pkg', 'CLAUDE.md'), 'SKIP');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).not.toContain(
      join(testDir, 'node_modules', 'pkg', 'CLAUDE.md'),
    );
  });

  test('.gitディレクトリをスキップする', () => {
    const testDir = setup();
    mkdirSync(join(testDir, '.git', 'hooks'), { recursive: true });
    writeFileSync(join(testDir, '.git', 'hooks', 'CLAUDE.md'), 'SKIP');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).not.toContain(
      join(testDir, '.git', 'hooks', 'CLAUDE.md'),
    );
  });

  test('複数のサブディレクトリをアルファベット順で読み込む', () => {
    const testDir = setup();
    mkdirSync(join(testDir, 'zzz'), { recursive: true });
    writeFileSync(join(testDir, 'zzz', 'CLAUDE.md'), 'ZZZ');
    mkdirSync(join(testDir, 'aaa'), { recursive: true });
    writeFileSync(join(testDir, 'aaa', 'CLAUDE.md'), 'AAA');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    const aaaIdx = result.content.indexOf('AAA');
    const zzzIdx = result.content.indexOf('ZZZ');
    expect(aaaIdx).toBeLessThan(zzzIdx);
    expect(result.loadedPaths[0]).toContain('aaa');
    expect(result.loadedPaths[1]).toContain('zzz');
  });

  test('読み取り権限がないファイルはスキップする', () => {
    const testDir = setup();
    const filePath = join(testDir, 'CLAUDE.md');
    writeFileSync(filePath, 'SECRET');
    chmodSync(filePath, 0o000);
    try {
      const result = loadClaudeMd(testDir, {
        globalConfigDir: join(testDir, 'fake-global'),
      });
      expect(result.content).toBe('');
      expect(result.loadedPaths).toEqual([]);
    } finally {
      chmodSync(filePath, 0o644);
    }
  });

  test('空のCLAUDE.mdファイルもloadedPathsに含める', () => {
    const testDir = setup();
    writeFileSync(join(testDir, 'CLAUDE.md'), '');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).toHaveLength(1);
    expect(result.loadedPaths).toContain(join(testDir, 'CLAUDE.md'));
  });

  test('ネストの深いサブディレクトリもMAX_DEPTH以内なら読み込む', () => {
    const testDir = setup();
    const deepDir = join(testDir, 'a', 'b', 'c', 'd');
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(deepDir, 'CLAUDE.md'), 'DEEP');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).toContain(join(deepDir, 'CLAUDE.md'));
  });

  test('MAX_DEPTHを超えるサブディレクトリはスキップする', () => {
    const testDir = setup();
    const tooDeepDir = join(testDir, 'a', 'b', 'c', 'd', 'e');
    mkdirSync(tooDeepDir, { recursive: true });
    writeFileSync(join(tooDeepDir, 'CLAUDE.md'), 'TOO_DEEP');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.loadedPaths).not.toContain(join(tooDeepDir, 'CLAUDE.md'));
  });

  test('複数ファイルの内容が\\n\\nで結合される', () => {
    const testDir = setup();
    writeFileSync(join(testDir, 'CLAUDE.md'), 'ROOT_CONTENT');
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'CLAUDE.md'), 'SUBDIR_CONTENT');
    const result = loadClaudeMd(testDir, {
      globalConfigDir: join(testDir, 'fake-global'),
    });
    expect(result.content).toBe('ROOT_CONTENT\n\nSUBDIR_CONTENT');
  });
});
