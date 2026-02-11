import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test';
import { Readable, Writable } from 'stream';
import { createInterface } from 'readline';
import { mkdtempSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import matter from 'gray-matter';
import { createSuccessResult } from '../../../helpers/mock-agent-sdk.js';

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

describe('roles create subcommand', () => {
  test('rolesCommand has create subcommand registered', async () => {
    const { rolesCommand } = await import(
      '../../../../src/cli/commands/roles.js'
    );

    const commandNames = rolesCommand.commands.map((c: any) => c.name());
    expect(commandNames).toContain('create');
  });

  test('createRoleAction creates a role file with correct frontmatter and body', async () => {
    const generatedBody = 'You are a **tester** role.\n\n## Responsibilities\n\n- Test all code';
    const successResult = createSuccessResult({ result: generatedBody });

    mock.module('@anthropic-ai/claude-agent-sdk', () => ({
      query: () => ({
        async *[Symbol.asyncIterator]() {
          yield successResult;
        },
        interrupt: mock(() => Promise.resolve()),
      }),
    }));

    const { createRoleAction } = await import(
      '../../../../src/cli/commands/roles.js'
    );

    const tmpDir = mkdtempSync(join(tmpdir(), 'devdemon-test-'));
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    // description, interval, maxTurns, tools, permissionMode, tags
    const rlFactory = mockRlFactory([
      'A test role',    // description
      '120',            // interval
      '15',             // maxTurns
      'Read,Write',     // tools
      'default',        // permissionMode
      'testing,qa',     // tags
    ]);

    await createRoleAction('tester', { rolesDir: tmpDir }, rlFactory);

    const filePath = join(tmpDir, 'tester.md');
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, 'utf-8');
    const { data, content: body } = matter(content);

    expect(data.name).toBe('tester');
    expect(data.interval).toBe(120);
    expect(data.maxTurns).toBe(15);
    expect(data.tools).toEqual(['Read', 'Write']);
    expect(data.permissionMode).toBe('default');
    expect(data.description).toBe('A test role');
    expect(data.tags).toEqual(['testing', 'qa']);
    expect(body.trim()).toBe(generatedBody);

    logSpy.mockRestore();
  });
});
