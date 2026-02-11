import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { resolve } from 'path';
import { loadAllRoles } from '../../../../src/roles/loader.js';

const FIXTURES_DIR = resolve(import.meta.dir, '../../../fixtures/roles');

describe('roles command', () => {
  let consoleLogs: string[];

  beforeEach(() => {
    consoleLogs = [];
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      consoleLogs.push(args.map(String).join(' '));
    });
  });

  test('roles list でロール一覧を取得できる', () => {
    const roles = loadAllRoles(FIXTURES_DIR);
    expect(roles.length).toBeGreaterThanOrEqual(3);
    const names = roles.map(r => r.frontmatter.name);
    expect(names).toContain('Software Engineer');
    expect(names).toContain('Product Manager');
  });

  test('roles show でロール詳細を取得できる', () => {
    const roles = loadAllRoles(FIXTURES_DIR);
    const swe = roles.find(
      r => r.frontmatter.name === 'Software Engineer'
        || r.filePath.endsWith('/valid-swe.md'),
    );
    expect(swe).toBeDefined();
    expect(swe!.frontmatter.name).toBe('Software Engineer');
    expect(swe!.frontmatter.interval).toBe(300);
    expect(swe!.frontmatter.tools).toContain('Read');
    expect(swe!.body).toContain('# Software Engineer');
  });
});
