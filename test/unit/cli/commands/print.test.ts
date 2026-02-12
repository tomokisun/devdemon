import { describe, test, expect } from 'bun:test';
import {
  buildPromptWithStdin,
  applyRoleOverrides,
} from '../../../../src/cli/commands/print.js';
import type { PrintOptions } from '../../../../src/cli/commands/print.js';
import type { RoleConfig } from '../../../../src/roles/types.js';

function makeRole(overrides: Partial<RoleConfig> = {}): RoleConfig {
  return {
    frontmatter: {
      name: 'Test Role',
      interval: 5,
      maxTurns: 50,
      permissionMode: 'acceptEdits',
      ...(overrides.frontmatter ?? {}),
    },
    body: 'default role body',
    filePath: '/roles/test.md',
    ...overrides,
  };
}

function makeOptions(overrides: Partial<PrintOptions> = {}): PrintOptions {
  return {
    print: 'test prompt',
    role: 'swe',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildPromptWithStdin
// ---------------------------------------------------------------------------
describe('buildPromptWithStdin', () => {
  test('stdinが空の時promptをそのまま返す', () => {
    expect(buildPromptWithStdin('hello', '')).toBe('hello');
  });

  test('stdinが空文字列の時promptをそのまま返す', () => {
    const result = buildPromptWithStdin('hello', '');
    expect(result).toBe('hello');
  });

  test('stdinがある時<stdin>タグで囲む', () => {
    const result = buildPromptWithStdin('analyze', 'file content');
    expect(result).toBe('<stdin>\nfile content\n</stdin>\n\nanalyze');
  });

  test('stdinに複数行がある時正しく囲む', () => {
    const result = buildPromptWithStdin('q', 'line1\nline2');
    expect(result).toBe('<stdin>\nline1\nline2\n</stdin>\n\nq');
  });
});

// ---------------------------------------------------------------------------
// applyRoleOverrides
// ---------------------------------------------------------------------------
describe('applyRoleOverrides', () => {
  test('オプションなしで元のロールと同じ値を返す', () => {
    const role = makeRole();
    const options = makeOptions();
    const result = applyRoleOverrides(role, options);

    expect(result.frontmatter.name).toBe('Test Role');
    expect(result.frontmatter.interval).toBe(5);
    expect(result.frontmatter.maxTurns).toBe(50);
    expect(result.frontmatter.permissionMode).toBe('acceptEdits');
    expect(result.body).toBe('default role body');
    expect(result.filePath).toBe('/roles/test.md');
  });

  test('元のroleを変更しない（イミュータブル）', () => {
    const role = makeRole();
    const options = makeOptions({
      maxTurns: '10',
      allowedTools: 'Read, Edit',
      systemPrompt: 'new body',
    });
    applyRoleOverrides(role, options);

    expect(role.frontmatter.maxTurns).toBe(50);
    expect(role.frontmatter.tools).toBeUndefined();
    expect(role.body).toBe('default role body');
  });

  test('--max-turns でmaxTurnsをオーバーライドする', () => {
    const role = makeRole();
    const options = makeOptions({ maxTurns: '10' });
    const result = applyRoleOverrides(role, options);

    expect(result.frontmatter.maxTurns).toBe(10);
  });

  test('--allowed-tools でカンマ区切りでtoolsをオーバーライドする', () => {
    const role = makeRole();
    const options = makeOptions({ allowedTools: 'Read, Edit, Bash' });
    const result = applyRoleOverrides(role, options);

    expect(result.frontmatter.tools).toEqual(['Read', 'Edit', 'Bash']);
  });

  test('--allowed-tools の空文字列はオーバーライドしない', () => {
    const role = makeRole();
    const options = makeOptions({ allowedTools: '  ' });
    const result = applyRoleOverrides(role, options);

    expect(result.frontmatter.tools).toBeUndefined();
  });

  test('--system-prompt で body を置き換える', () => {
    const role = makeRole();
    const options = makeOptions({ systemPrompt: 'new body' });
    const result = applyRoleOverrides(role, options);

    expect(result.body).toBe('new body');
  });

  test('--append-system-prompt で body に追記する', () => {
    const role = makeRole();
    const options = makeOptions({ appendSystemPrompt: 'extra' });
    const result = applyRoleOverrides(role, options);

    expect(result.body).toBe('default role body\n\nextra');
  });

  test('--system-prompt と --append-system-prompt 両方指定時に --system-prompt 優先', () => {
    const role = makeRole();
    const options = makeOptions({
      systemPrompt: 'override body',
      appendSystemPrompt: 'extra',
    });
    const result = applyRoleOverrides(role, options);

    expect(result.body).toBe('override body');
  });
});
