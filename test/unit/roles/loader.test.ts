import { describe, test, expect } from 'bun:test';
import { resolve, join } from 'path';
import { loadRole, loadAllRoles, resolveRolesDir, getBuiltinRolesDir, loadAllRolesGrouped } from '../../../src/roles/loader.js';

const FIXTURES_DIR = resolve(import.meta.dir, '../../fixtures/roles');

describe('RoleLoader', () => {
  describe('loadRole', () => {
    test('正常なMarkdownファイルからRoleConfigを生成する', () => {
      const role = loadRole(join(FIXTURES_DIR, 'valid-swe.md'));
      expect(role.frontmatter.name).toBe('Software Engineer');
      expect(role.frontmatter.interval).toBe(300);
      expect(role.frontmatter.maxTurns).toBe(30);
      expect(role.frontmatter.permissionMode).toBe('acceptEdits');
      expect(role.filePath).toBe(resolve(FIXTURES_DIR, 'valid-swe.md'));
    });

    test('frontmatterが空でもデフォルト値が適用される', () => {
      const role = loadRole(join(FIXTURES_DIR, 'minimal.md'));
      expect(role.frontmatter.name).toBe('Minimal Role');
      expect(role.frontmatter.interval).toBe(300);
      expect(role.frontmatter.maxTurns).toBe(50);
      expect(role.frontmatter.permissionMode).toBe('acceptEdits');
    });

    test('name未指定の場合はエラーをthrowする', () => {
      expect(() => loadRole(join(FIXTURES_DIR, 'invalid-no-name.md'))).toThrow();
    });

    test('intervalが負数の場合はエラー', () => {
      expect(() => loadRole(join(FIXTURES_DIR, 'invalid-bad-interval.md'))).toThrow();
    });

    test('tools配列が正しくパースされる', () => {
      const role = loadRole(join(FIXTURES_DIR, 'valid-swe.md'));
      expect(role.frontmatter.tools).toEqual(['Read', 'Edit', 'Write', 'Bash']);
    });

    test('body（Markdown本文）が正しく抽出される', () => {
      const role = loadRole(join(FIXTURES_DIR, 'valid-swe.md'));
      expect(role.body).toContain('# Software Engineer');
      expect(role.body).toContain('Find bugs');
    });

    test('空のbodyでもエラーにならない', () => {
      const role = loadRole(join(FIXTURES_DIR, 'minimal.md'));
      expect(role.body).toBe('Minimal role body.');
    });

    test('ファイルが存在しない場合はエラーをthrowする', () => {
      expect(() => loadRole('/nonexistent/path/role.md')).toThrow();
    });

    test('tags配列が正しくパースされる', () => {
      const role = loadRole(join(FIXTURES_DIR, 'valid-swe.md'));
      expect(role.frontmatter.tags).toEqual(['engineering']);
    });

    test('descriptionが正しくパースされる', () => {
      const role = loadRole(join(FIXTURES_DIR, 'valid-swe.md'));
      expect(role.frontmatter.description).toBe('Test SWE role');
    });
  });

  describe('loadAllRoles', () => {
    test('ディレクトリ内の全.mdファイルを読み込む（無効ファイルはスキップ）', () => {
      const roles = loadAllRoles(FIXTURES_DIR);
      const names = roles.map(r => r.frontmatter.name);
      expect(names).toContain('Software Engineer');
      expect(names).toContain('Product Manager');
      expect(names).toContain('Minimal Role');
    });

    test('ディレクトリが存在しない場合は空配列を返す', () => {
      const roles = loadAllRoles('/nonexistent/directory');
      expect(roles).toEqual([]);
    });

    test('一部無効なファイルがあっても他は読み込む', () => {
      const roles = loadAllRoles(FIXTURES_DIR);
      // invalid-no-name.md と invalid-bad-interval.md はスキップされる
      expect(roles.length).toBeGreaterThanOrEqual(3);
      const names = roles.map(r => r.frontmatter.name);
      expect(names).not.toContain(undefined);
    });
  });

  describe('resolveRolesDir', () => {
    test('引数のrolesDir指定時はそのパスを返す', () => {
      const dir = resolveRolesDir({ rolesDir: '/custom/roles' });
      expect(dir).toBe(resolve('/custom/roles'));
    });

    test('未指定時はカレントの./roles/があればそれを返す', () => {
      // プロジェクトルートに roles/ があるので
      const dir = resolveRolesDir();
      expect(dir).toContain('roles');
    });

    test('cwdにroles/が存在しない場合はビルトインrolesを返す', () => {
      const originalCwd = process.cwd;
      process.cwd = () => '/nonexistent/path';
      try {
        const dir = resolveRolesDir();
        expect(dir).toContain('roles');
      } finally {
        process.cwd = originalCwd;
      }
    });
  });

  describe('getBuiltinRolesDir', () => {
    test('ビルトインrolesディレクトリパスを返す', () => {
      const dir = getBuiltinRolesDir();
      expect(dir).toContain('roles');
      // ビルトインディレクトリは実際に存在する
      expect(dir).toMatch(/roles$/);
    });
  });

  describe('loadAllRolesGrouped', () => {
    test('ビルトインロールを返す', () => {
      const grouped = loadAllRolesGrouped();
      expect(grouped.builtin.length).toBeGreaterThanOrEqual(2);
      const names = grouped.builtin.map(r => r.frontmatter.name);
      expect(names).toContain('Software Engineer');
      expect(names).toContain('Product Manager');
    });

    test('プロジェクトロールが存在しない場合は空配列を返す', () => {
      const grouped = loadAllRolesGrouped({ rolesDir: '/nonexistent/path' });
      expect(grouped.project).toEqual([]);
    });

    test('カスタムrolesDirが指定された場合はそれをプロジェクトロールとして使用する', () => {
      const grouped = loadAllRolesGrouped({ rolesDir: FIXTURES_DIR });
      expect(grouped.project.length).toBeGreaterThanOrEqual(3);
      const names = grouped.project.map(r => r.frontmatter.name);
      expect(names).toContain('Software Engineer');
    });
  });
});
