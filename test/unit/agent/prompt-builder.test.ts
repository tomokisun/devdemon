import { describe, test, expect, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { PromptBuilder, type StateStoreReader } from '../../../src/agent/prompt-builder.js';
import { ProgressTracker } from '../../../src/agent/progress-tracker.js';
import { createTestRole } from '../../helpers/test-role-factory.js';

function createMockState(overrides?: Partial<StateStoreReader>): StateStoreReader {
  return {
    getRepoPath: () => '/test/repo',
    getRecentHistory: () => [],
    getStats: () => ({ totalCycles: 0 }),
    ...overrides,
  };
}

describe('PromptBuilder', () => {
  let testDir: string | undefined;

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    testDir = undefined;
  });

  function setup(opts?: {
    stateOverrides?: Partial<StateStoreReader>;
    progressContent?: string | null;
    roleName?: string;
  }) {
    testDir = join(tmpdir(), `devdemon-prompt-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    if (opts?.progressContent !== undefined && opts.progressContent !== null) {
      writeFileSync(join(testDir, 'progress.md'), opts.progressContent);
    }

    const role = createTestRole({
      frontmatter: { name: opts?.roleName ?? 'Test Role' },
    });
    const state = createMockState(opts?.stateOverrides);
    const progressTracker = new ProgressTracker(testDir);
    const builder = new PromptBuilder(role, state, progressTracker);

    return { builder, role, state };
  }

  describe('buildUser', () => {
    test('ユーザー指示をコンテキストでラップする', () => {
      const { builder } = setup();
      const result = builder.buildUser('Fix the bug');
      expect(result).toContain('## User Instruction');
      expect(result).toContain('Fix the bug');
    });

    test('コンテキストにリポジトリパスが含まれる', () => {
      const { builder } = setup({
        stateOverrides: { getRepoPath: () => '/my/project' },
      });
      const result = builder.buildUser('test');
      expect(result).toContain('/my/project');
    });

    test('コンテキストにロール名が含まれる', () => {
      const { builder } = setup({ roleName: 'Code Reviewer' });
      const result = builder.buildUser('test');
      expect(result).toContain('Code Reviewer');
    });

    test('コンテキストにサイクル番号が含まれる', () => {
      const { builder } = setup({
        stateOverrides: { getStats: () => ({ totalCycles: 4 }) },
      });
      const result = builder.buildUser('test');
      expect(result).toContain('Cycle: #5');
    });
  });

  describe('buildAutonomous', () => {
    test('ロール情報とコンテキストが含まれる', () => {
      const { builder } = setup({ roleName: 'Software Engineer' });
      const result = builder.buildAutonomous();
      expect(result).toContain('## Context');
      expect(result).toContain('Software Engineer');
    });

    test('最近のタスク履歴が含まれる', () => {
      const { builder } = setup({
        stateOverrides: {
          getRecentHistory: () => [
            { status: 'success', prompt: 'Fix login bug' },
            { status: 'error', prompt: 'Update database schema' },
          ],
        },
      });
      const result = builder.buildAutonomous();
      expect(result).toContain('## Recent Task History');
      expect(result).toContain('[success] Fix login bug');
      expect(result).toContain('[error] Update database schema');
    });

    test('履歴が空の場合「No previous tasks.」と表示する', () => {
      const { builder } = setup();
      const result = builder.buildAutonomous();
      expect(result).toContain('No previous tasks.');
    });

    test('重複作業を避ける指示が含まれる', () => {
      const { builder } = setup();
      const result = builder.buildAutonomous();
      expect(result).toContain('does not duplicate recent work');
    });

    test('progress.mdが存在する場合その内容が含まれる', () => {
      const { builder } = setup({
        progressContent: '## Done\n- Implemented auth module',
      });
      const result = builder.buildAutonomous();
      expect(result).toContain('## Progress Notes');
      expect(result).toContain('Implemented auth module');
    });

    test('progress.mdが存在しなくてもエラーにならない', () => {
      const { builder } = setup({ progressContent: null });
      const result = builder.buildAutonomous();
      expect(result).not.toContain('## Progress Notes');
    });

    test('テスト実行ガイドラインが含まれる', () => {
      const { builder } = setup();
      const result = builder.buildAutonomous();
      expect(result).toContain('run existing tests to understand current state');
    });

    test('リグレッション防止ガイドラインが含まれる', () => {
      const { builder } = setup();
      const result = builder.buildAutonomous();
      expect(result).toContain('run tests again to ensure no regressions');
    });

    test('progress.md更新指示が含まれる', () => {
      const { builder } = setup();
      const result = builder.buildAutonomous();
      expect(result).toContain('update .devdemon/progress.md');
    });
  });
});
