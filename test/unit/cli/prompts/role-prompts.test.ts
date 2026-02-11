import { describe, test, expect } from 'bun:test';
import { Readable, Writable } from 'stream';
import { createInterface } from 'readline';
import { promptRoleFrontmatter } from '../../../../src/cli/prompts/role-prompts.js';

function mockRlFactory(answers: string[]) {
  return () => {
    let idx = 0;
    const input = new Readable({ read() {} });
    const output = new Writable({ write(_, __, cb) { cb(); } });
    const rl = createInterface({ input, output });
    (rl as any).question = (_q: string, cb: (a: string) => void) => { cb(answers[idx++] ?? ''); };
    return rl;
  };
}

describe('promptRoleFrontmatter', () => {
  test('全てデフォルト値が使われる', async () => {
    // description, interval, maxTurns, tools, permissionMode, tags
    const rlFactory = mockRlFactory(['', '', '', '', '', '']);

    const result = await promptRoleFrontmatter({ rlFactory });

    expect(result.description).toBeUndefined();
    expect(result.interval).toBe(300);
    expect(result.maxTurns).toBe(50);
    expect(result.tools).toBeUndefined();
    expect(result.permissionMode).toBe('acceptEdits');
    expect(result.tags).toBeUndefined();
  });

  test('カスタム値を正しく受け取る', async () => {
    const rlFactory = mockRlFactory([
      'My custom role',     // description
      '60',                 // interval
      '10',                 // maxTurns
      'Read,Write,Bash',    // tools
      'bypassPermissions',  // permissionMode
      'backend,api',        // tags
    ]);

    const result = await promptRoleFrontmatter({ rlFactory });

    expect(result.description).toBe('My custom role');
    expect(result.interval).toBe(60);
    expect(result.maxTurns).toBe(10);
    expect(result.tools).toEqual(['Read', 'Write', 'Bash']);
    expect(result.permissionMode).toBe('bypassPermissions');
    expect(result.tags).toEqual(['backend', 'api']);
  });

  test('intervalが不正な文字列の場合にエラーを投げる', async () => {
    const rlFactory = mockRlFactory(['', 'abc', '', '', '', '']);

    await expect(promptRoleFrontmatter({ rlFactory })).rejects.toThrow(
      'Invalid interval: "abc" must be a positive number',
    );
  });

  test('intervalが負の値の場合にエラーを投げる', async () => {
    const rlFactory = mockRlFactory(['', '-5', '', '', '', '']);

    await expect(promptRoleFrontmatter({ rlFactory })).rejects.toThrow(
      'Invalid interval: "-5" must be a positive number',
    );
  });

  test('permissionModeが不正な値の場合にエラーを投げる', async () => {
    const rlFactory = mockRlFactory(['', '', '', '', 'invalid', '']);

    await expect(promptRoleFrontmatter({ rlFactory })).rejects.toThrow(
      'Invalid permissionMode: "invalid" must be one of default, acceptEdits, bypassPermissions',
    );
  });

  test('maxTurnsが0の場合にエラーを投げる', async () => {
    const rlFactory = mockRlFactory(['', '', '0', '', '', '']);

    await expect(promptRoleFrontmatter({ rlFactory })).rejects.toThrow(
      'Invalid maxTurns: "0" must be a positive number',
    );
  });
});
