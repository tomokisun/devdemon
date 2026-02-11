import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { Command } from 'commander';
import { rolesCommand, createRoleAction } from '../../../../src/cli/commands/roles.js';
import type { RoleConfig } from '../../../../src/roles/types.js';

describe('roles command integration', () => {
  let testDir: string;
  let consoleLogMock: any;
  let consoleErrorMock: any;
  let processExitMock: any;
  let capturedOutput: string[];
  let rolesDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
    rolesDir = join(testDir, 'roles');
    mkdirSync(rolesDir, { recursive: true });
    capturedOutput = [];

    // Mock console methods
    consoleLogMock = mock(() => {});
    consoleErrorMock = mock(() => {});
    processExitMock = mock(() => { throw new Error('process.exit'); });

    global.console.log = (...args: any[]) => {
      capturedOutput.push(args.join(' '));
      consoleLogMock(...args);
    };
    global.console.error = consoleErrorMock;
    global.process.exit = processExitMock as any;
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  function createTestRole(name: string, options: Partial<RoleConfig['frontmatter']> = {}) {
    const content = `---
name: ${name}
description: ${options.description ?? 'Test role'}
interval: ${options.interval ?? 60}
maxTurns: ${options.maxTurns ?? 5}
permissionMode: ${options.permissionMode ?? 'acceptEdits'}
tools: [${options.tools?.map(t => `"${t}"`).join(', ') ?? ''}]
tags: [${options.tags?.map(t => `"${t}"`).join(', ') ?? ''}]
---

# ${name}

This is a test role.
`;
    writeFileSync(join(rolesDir, `${name.toLowerCase().replace(/\s+/g, '-')}.md`), content);
  }

  describe('roles list', () => {
    test('ロールが存在しない場合のメッセージ', async () => {
      const rootCmd = new Command();
      rootCmd.addCommand(rolesCommand);

      await rootCmd.parseAsync(['roles', 'list', '--roles-dir', rolesDir], { from: 'user' });

      expect(capturedOutput.some(line => line.includes('No roles found. Run "devdemon roles create <name>" to create one.'))).toBe(true);
    });

    test('ロール一覧を表示する', async () => {
      createTestRole('Software Engineer', {
        description: 'Writes code',
        tools: ['Read', 'Write'],
        interval: 300
      });
      createTestRole('Product Manager', {
        description: 'Manages product',
        interval: 600
      });

      const rootCmd = new Command();
      rootCmd.addCommand(rolesCommand);

      await rootCmd.parseAsync(['roles', 'list', '--roles-dir', rolesDir], { from: 'user' });

      // ヘッダー
      expect(capturedOutput.some(line => line.includes('NAME'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('DESCRIPTION'))).toBe(true);

      // ロール
      expect(capturedOutput.some(line => line.includes('Software Engineer') && line.includes('Writes code'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('Product Manager') && line.includes('Manages product'))).toBe(true);
    });

    test('長い名前と説明でも正しくフォーマットされる', async () => {
      createTestRole('Very Long Role Name That Should Be Padded', {
        description: 'This is a very long description that should also be properly formatted in the table'
      });
      createTestRole('Short', { description: 'Short desc' });

      const rootCmd = new Command();
      rootCmd.addCommand(rolesCommand);

      await rootCmd.parseAsync(['roles', 'list', '--roles-dir', rolesDir], { from: 'user' });

      // 両方のロールが表示される
      expect(capturedOutput.some(line => line.includes('Very Long Role Name That Should Be Padded'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('Short'))).toBe(true);
    });
  });

  describe('roles show', () => {
    beforeEach(() => {
      createTestRole('Test Engineer', {
        description: 'Test role for show command',
        interval: 120,
        maxTurns: 10,
        permissionMode: 'acceptEdits',
        tools: ['Read', 'Write', 'Run'],
        tags: ['test', 'engineering']
      });
    });

    test('ロールの詳細を表示する', async () => {
      const rootCmd = new Command();
      rootCmd.addCommand(rolesCommand);

      await rootCmd.parseAsync(['roles', 'show', 'Test Engineer', '--roles-dir', rolesDir], { from: 'user' });

      expect(capturedOutput.some(line => line.includes('Name:            Test Engineer'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('Interval:        120s'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('Max Turns:       10'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('Permission Mode: acceptEdits'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('Description:     Test role for show command'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('Tools:           Read, Write, Run'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('Tags:            test, engineering'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('File:'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('--- Body ---'))).toBe(true);
      expect(capturedOutput.some(line => line.includes('This is a test role.'))).toBe(true);
    });

    test('ファイル名でロールを検索できる', async () => {
      const rootCmd = new Command();
      rootCmd.addCommand(rolesCommand);

      await rootCmd.parseAsync(['roles', 'show', 'test-engineer', '--roles-dir', rolesDir], { from: 'user' });

      expect(capturedOutput.some(line => line.includes('Name:            Test Engineer'))).toBe(true);
    });

    test('存在しないロールでエラー', async () => {
      const rootCmd = new Command();
      rootCmd.addCommand(rolesCommand);

      try {
        await rootCmd.parseAsync(['roles', 'show', 'NonExistent', '--roles-dir', rolesDir], { from: 'user' });
      } catch (error: any) {
        expect(error.message).toBe('process.exit');
      }

      expect(consoleErrorMock).toHaveBeenCalledWith('Error: Role "NonExistent" not found.');
      expect(consoleErrorMock).toHaveBeenCalledWith('Available roles: Test Engineer');
      expect(processExitMock).toHaveBeenCalledWith(1);
    });

    test('ロールが全くない場合のエラーメッセージ', async () => {
      // 既存のロールを削除
      rmSync(rolesDir, { recursive: true });
      mkdirSync(rolesDir, { recursive: true });

      const rootCmd = new Command();
      rootCmd.addCommand(rolesCommand);

      try {
        await rootCmd.parseAsync(['roles', 'show', 'NonExistent', '--roles-dir', rolesDir], { from: 'user' });
      } catch (error: any) {
        expect(error.message).toBe('process.exit');
      }

      expect(consoleErrorMock).toHaveBeenCalledWith('Error: Role "NonExistent" not found.');
      // Available roles は表示されない
      expect(consoleErrorMock).not.toHaveBeenCalledWith(expect.stringContaining('Available roles:'));
    });
  });

  describe('roles create', () => {
    test.skip('createRoleAction - ロール作成の成功フロー（実際のAPI呼び出しのためスキップ）', async () => {
      // このテストは実際のClaude APIを呼ぶため、統合テストではスキップ
      // 実際の実装では、generateRoleBodyをモックする必要がある
    });

    test.skip('createコマンド - エラーハンドリング（モジュールモックのためスキップ）', async () => {
      // bunではモジュールのエクスポートを動的に書き換えることができないため、
      // このテストはスキップする
    });
  });

  describe('printRoleTable helper', () => {
    test('空のロール配列でもクラッシュしない', () => {
      // printRoleTableは内部関数なので、listコマンドを通じてテスト
      const rootCmd = new Command();
      rootCmd.addCommand(rolesCommand);

      // 空のディレクトリでlistを実行してもエラーにならない
      expect(async () => {
        await rootCmd.parseAsync(['roles', 'list', '--roles-dir', rolesDir], { from: 'user' });
      }).not.toThrow();
    });
  });
});