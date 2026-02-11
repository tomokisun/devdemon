import { describe, test, expect, afterEach } from 'bun:test';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { existsSync, rmSync, readFileSync } from 'fs';
import matter from 'gray-matter';
import { writeRole } from '../../../src/roles/writer.js';
import { loadRole } from '../../../src/roles/loader.js';
import type { RoleFrontmatter } from '../../../src/roles/types.js';

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = join(tmpdir(), `devdemon-test-${randomUUID()}`);
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  tmpDirs = [];
});

const baseFrontmatter: RoleFrontmatter = {
  name: 'Software Engineer',
  interval: 300,
  maxTurns: 50,
  tools: ['Read', 'Edit', 'Write'],
  permissionMode: 'acceptEdits',
  description: 'An autonomous SWE role',
  tags: ['engineering'],
};

describe('writeRole', () => {
  test('rolesディレクトリが存在しない場合に作成する', () => {
    const tmp = makeTmpDir();
    const rolesDir = join(tmp, 'nested', 'roles');

    expect(existsSync(rolesDir)).toBe(false);

    writeRole({ rolesDir, frontmatter: baseFrontmatter, body: '# Hello' });

    expect(existsSync(rolesDir)).toBe(true);
  });

  test('正しいfrontmatter+bodyのMarkdownを書き出す', () => {
    const tmp = makeTmpDir();
    const rolesDir = join(tmp, 'roles');

    const filePath = writeRole({
      rolesDir,
      frontmatter: baseFrontmatter,
      body: '# Software Engineer\n\nDo great work.',
    });

    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    expect(data.name).toBe('Software Engineer');
    expect(data.interval).toBe(300);
    expect(data.maxTurns).toBe(50);
    expect(data.tools).toEqual(['Read', 'Edit', 'Write']);
    expect(data.permissionMode).toBe('acceptEdits');
    expect(data.description).toBe('An autonomous SWE role');
    expect(data.tags).toEqual(['engineering']);
    expect(content.trim()).toBe('# Software Engineer\n\nDo great work.');
  });

  test('ファイル名をslugifyする ("Software Engineer" → "software-engineer.md")', () => {
    const tmp = makeTmpDir();
    const rolesDir = join(tmp, 'roles');

    const filePath = writeRole({
      rolesDir,
      frontmatter: { ...baseFrontmatter, name: 'Software Engineer' },
      body: '# Test',
    });

    expect(filePath).toEndWith('software-engineer.md');
  });

  test('同名ファイルが既に存在する場合はエラーをthrowする', () => {
    const tmp = makeTmpDir();
    const rolesDir = join(tmp, 'roles');

    writeRole({ rolesDir, frontmatter: baseFrontmatter, body: '# First' });

    expect(() =>
      writeRole({ rolesDir, frontmatter: baseFrontmatter, body: '# Second' }),
    ).toThrow(/already exists/);
  });

  test('writeRoleしたファイルをloadRoleで読み込むとデータが一致する (round-trip)', () => {
    const tmp = makeTmpDir();
    const rolesDir = join(tmp, 'roles');
    const body = '# Round Trip Test\n\nVerify data integrity.';

    const filePath = writeRole({
      rolesDir,
      frontmatter: baseFrontmatter,
      body,
    });

    const loaded = loadRole(filePath);

    expect(loaded.frontmatter.name).toBe(baseFrontmatter.name);
    expect(loaded.frontmatter.interval).toBe(baseFrontmatter.interval);
    expect(loaded.frontmatter.maxTurns).toBe(baseFrontmatter.maxTurns);
    expect(loaded.frontmatter.tools).toEqual(baseFrontmatter.tools);
    expect(loaded.frontmatter.permissionMode).toBe(baseFrontmatter.permissionMode);
    expect(loaded.frontmatter.description).toBe(baseFrontmatter.description);
    expect(loaded.frontmatter.tags).toEqual(baseFrontmatter.tags);
    expect(loaded.body).toBe(body);
    expect(loaded.filePath).toBe(filePath);
  });
});
