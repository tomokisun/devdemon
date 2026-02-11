import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { Command } from 'commander';
import { Readable, Writable } from 'stream';
import { createInterface } from 'readline';
import { resolve, join } from 'path';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import type { RoleConfig } from '../../../../src/roles/types.js';

const FIXTURES_DIR = resolve(import.meta.dir, '../../../fixtures/roles');

function createStartCommand(): Command {
  return new Command('start')
    .option('-r, --role <name>', 'Role name to use')
    .option('--repo <path>', 'Repository path to work on')
    .option('--roles-dir <path>', 'Custom roles directory')
    .option('-i, --interval <seconds>', 'Override interval in seconds')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--dry-run', 'Render UI without starting daemon (for testing)')
    .exitOverride()
    .action(() => {});
}

describe('start command', () => {
  test('--role オプションをパースできる', () => {
    const cmd = createStartCommand();
    cmd.parse(['--role', 'swe'], { from: 'user' });
    expect(cmd.opts().role).toBe('swe');
  });

  test('--repo オプションをパースできる', () => {
    const cmd = createStartCommand();
    cmd.parse(['--repo', '/my/repo'], { from: 'user' });
    expect(cmd.opts().repo).toBe('/my/repo');
  });

  test('--verbose オプションをパースできる', () => {
    const cmd = createStartCommand();
    cmd.parse(['--verbose'], { from: 'user' });
    expect(cmd.opts().verbose).toBe(true);
  });

  test('--interval オプションをパースできる', () => {
    const cmd = createStartCommand();
    cmd.parse(['--interval', '30'], { from: 'user' });
    expect(cmd.opts().interval).toBe('30');
  });

  test('--roles-dir オプションをパースできる', () => {
    const cmd = createStartCommand();
    cmd.parse(['--roles-dir', '/custom/roles'], { from: 'user' });
    expect(cmd.opts().rolesDir).toBe('/custom/roles');
  });

  test('短縮形 -r が使える', () => {
    const cmd = createStartCommand();
    cmd.parse(['-r', 'swe'], { from: 'user' });
    expect(cmd.opts().role).toBe('swe');
  });

  test('短縮形 -v が使える', () => {
    const cmd = createStartCommand();
    cmd.parse(['-v'], { from: 'user' });
    expect(cmd.opts().verbose).toBe(true);
  });

  test('短縮形 -i が使える', () => {
    const cmd = createStartCommand();
    cmd.parse(['-i', '60'], { from: 'user' });
    expect(cmd.opts().interval).toBe('60');
  });

  test('--dry-run オプションをパースできる', () => {
    const cmd = createStartCommand();
    cmd.parse(['--dry-run'], { from: 'user' });
    expect(cmd.opts().dryRun).toBe(true);
  });

  test('オプションなしでもパースできる', () => {
    const cmd = createStartCommand();
    cmd.parse([], { from: 'user' });
    expect(cmd.opts().role).toBeUndefined();
    expect(cmd.opts().repo).toBeUndefined();
    expect(cmd.opts().verbose).toBeUndefined();
    expect(cmd.opts().dryRun).toBeUndefined();
  });
});

describe('program wiring', () => {
  test('program はCommandインスタンスである', async () => {
    const { program } = await import('../../../../src/cli/index.js');
    expect(program).toBeInstanceOf(Command);
    expect(program.name()).toBe('devdemon');
  });

  test('program は必要なオプションを全て持つ', async () => {
    const { program } = await import('../../../../src/cli/index.js');
    const opts = program.options.map((o: any) => o.long);
    expect(opts).toContain('--role');
    expect(opts).toContain('--repo');
    expect(opts).toContain('--roles-dir');
    expect(opts).toContain('--interval');
    expect(opts).toContain('--verbose');
    expect(opts).toContain('--dry-run');
  });

  test('program の description が設定されている', async () => {
    const { program } = await import('../../../../src/cli/index.js');
    expect(program.description()).toBe('Autonomous AI agent daemon powered by Claude Code');
  });
});

function makeRole(name: string, description?: string): RoleConfig {
  return {
    frontmatter: {
      name,
      interval: 300,
      maxTurns: 50,
      permissionMode: 'acceptEdits',
      ...(description ? { description } : {}),
    },
    body: `# ${name}`,
    filePath: `/roles/${name}.md`,
  };
}

describe('formatRoleMenu', () => {
  test('ロール名と番号を表示する', async () => {
    const { formatRoleMenu } = await import('../../../../src/cli/commands/start.js');
    const roles = [makeRole('swe'), makeRole('reviewer')];
    const menu = formatRoleMenu(roles);
    expect(menu).toContain('1. swe');
    expect(menu).toContain('2. reviewer');
  });

  test('descriptionがある場合は表示する', async () => {
    const { formatRoleMenu } = await import('../../../../src/cli/commands/start.js');
    const roles = [makeRole('swe', 'Software engineer role')];
    const menu = formatRoleMenu(roles);
    expect(menu).toContain('swe - Software engineer role');
  });

  test('descriptionがない場合は名前のみ表示する', async () => {
    const { formatRoleMenu } = await import('../../../../src/cli/commands/start.js');
    const roles = [makeRole('swe')];
    const menu = formatRoleMenu(roles);
    expect(menu).toBe('  1. swe');
  });
});

describe('selectRole', () => {
  test('ロールが0件の場合はエラーで終了する', async () => {
    const { selectRole } = await import('../../../../src/cli/commands/start.js');
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    try {
      await selectRole([]);
    } catch {
      // expected
    }

    expect(errorSpy).toHaveBeenCalledWith('No roles found.');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('ロールが1件の場合は自動選択する', async () => {
    const { selectRole } = await import('../../../../src/cli/commands/start.js');
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const role = makeRole('swe');
    const result = await selectRole([role]);

    expect(result).toBe(role);
    expect(logSpy).toHaveBeenCalledWith('Auto-selected role: swe');

    logSpy.mockRestore();
  });

  test('複数ロールで有効な番号を選択するとそのロールが返る', async () => {
    const { selectRole } = await import('../../../../src/cli/commands/start.js');
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const roles = [makeRole('swe'), makeRole('reviewer'), makeRole('tester')];

    const mockRlFactory = () => {
      const input = new Readable({ read() {} });
      const output = new Writable({ write(_, __, cb) { cb(); } });
      const rl = createInterface({ input, output });
      // Simulate user typing "2" after question is asked
      const origQuestion = rl.question.bind(rl);
      rl.question = (query: string, cb: (answer: string) => void) => {
        cb('2');
      };
      return rl;
    };

    const result = await selectRole(roles, mockRlFactory);
    expect(result).toBe(roles[1]);

    logSpy.mockRestore();
  });

  test('複数ロールで無効な番号を選択するとエラーで終了する', async () => {
    const { selectRole } = await import('../../../../src/cli/commands/start.js');
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const roles = [makeRole('swe'), makeRole('reviewer')];

    const mockRlFactory = () => {
      const input = new Readable({ read() {} });
      const output = new Writable({ write(_, __, cb) { cb(); } });
      const rl = createInterface({ input, output });
      rl.question = (query: string, cb: (answer: string) => void) => {
        cb('99');
      };
      return rl;
    };

    try {
      await selectRole(roles, mockRlFactory);
    } catch {
      // expected
    }

    expect(errorSpy).toHaveBeenCalledWith('Invalid selection.');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe('resolveRole', () => {
  test('--role指定時に正しいロールをロードする', async () => {
    const { resolveRole } = await import('../../../../src/cli/commands/start.js');
    const role = await resolveRole({ role: 'valid-swe', rolesDir: FIXTURES_DIR });
    expect(role.frontmatter.name).toBe('Software Engineer');
  });

  test('--role指定でファイルが見つからない場合にprocess.exitを呼ぶ', async () => {
    const { resolveRole } = await import('../../../../src/cli/commands/start.js');
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    try {
      await resolveRole({ role: 'nonexistent', rolesDir: FIXTURES_DIR });
    } catch {
      // expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error: Role "nonexistent" not found'),
    );

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('--role未指定時にrolesから選択する（1件なら自動選択）', async () => {
    const { resolveRole } = await import('../../../../src/cli/commands/start.js');
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const tempDir = mkdtempSync(join(tmpdir(), 'devdemon-test-'));
    writeFileSync(
      join(tempDir, 'solo.md'),
      '---\nname: Solo Role\ninterval: 60\nmaxTurns: 10\npermissionMode: acceptEdits\n---\nBody',
    );

    const role = await resolveRole({ rolesDir: tempDir });
    expect(role.frontmatter.name).toBe('Solo Role');

    logSpy.mockRestore();
  });
});

describe('startAction', () => {
  test('startAction は関数としてエクスポートされている', async () => {
    const { startAction } = await import('../../../../src/cli/commands/start.js');
    expect(typeof startAction).toBe('function');
  });

  test('Daemonを生成してstart()を呼ぶ', async () => {
    const { mockQuery } = await import('../../../helpers/mock-agent-sdk.js');
    mockQuery([]);

    const { Daemon } = await import('../../../../src/daemon/daemon.js');
    const startSpy = spyOn(Daemon.prototype, 'start').mockResolvedValue(undefined);
    const stopSpy = spyOn(Daemon.prototype, 'stop').mockResolvedValue(undefined);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const { startAction } = await import('../../../../src/cli/commands/start.js');

    const tempDir = mkdtempSync(join(tmpdir(), 'devdemon-start-'));
    const rolesDir = mkdtempSync(join(tmpdir(), 'devdemon-roles-'));
    writeFileSync(
      join(rolesDir, 'test.md'),
      '---\nname: Test\ninterval: 60\nmaxTurns: 5\npermissionMode: acceptEdits\n---\nBody',
    );

    await startAction({
      role: 'test',
      repo: tempDir,
      rolesDir,
    });

    expect(startSpy).toHaveBeenCalled();

    startSpy.mockRestore();
    stopSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('--interval でintervalを上書きする', async () => {
    const { mockQuery } = await import('../../../helpers/mock-agent-sdk.js');
    mockQuery([]);

    const { Daemon } = await import('../../../../src/daemon/daemon.js');
    let capturedRole: any = null;
    const startSpy = spyOn(Daemon.prototype, 'start').mockImplementation(async function (this: any) {
      capturedRole = this.role;
    });
    const stopSpy = spyOn(Daemon.prototype, 'stop').mockResolvedValue(undefined);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const { startAction } = await import('../../../../src/cli/commands/start.js');

    const tempDir = mkdtempSync(join(tmpdir(), 'devdemon-start-'));
    const rolesDir = mkdtempSync(join(tmpdir(), 'devdemon-roles-'));
    writeFileSync(
      join(rolesDir, 'test.md'),
      '---\nname: Test\ninterval: 60\nmaxTurns: 5\npermissionMode: acceptEdits\n---\nBody',
    );

    await startAction({
      role: 'test',
      repo: tempDir,
      rolesDir,
      interval: '15',
    });

    expect(capturedRole.frontmatter.interval).toBe(15);

    startSpy.mockRestore();
    stopSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('--verbose でロール情報をログ出力する', async () => {
    const { mockQuery } = await import('../../../helpers/mock-agent-sdk.js');
    mockQuery([]);

    const { Daemon } = await import('../../../../src/daemon/daemon.js');
    const startSpy = spyOn(Daemon.prototype, 'start').mockResolvedValue(undefined);
    const stopSpy = spyOn(Daemon.prototype, 'stop').mockResolvedValue(undefined);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const { startAction } = await import('../../../../src/cli/commands/start.js');

    const tempDir = mkdtempSync(join(tmpdir(), 'devdemon-start-'));
    const rolesDir = mkdtempSync(join(tmpdir(), 'devdemon-roles-'));
    writeFileSync(
      join(rolesDir, 'test.md'),
      '---\nname: VerboseTest\ninterval: 60\nmaxTurns: 5\npermissionMode: acceptEdits\n---\nBody',
    );

    await startAction({
      role: 'test',
      repo: tempDir,
      rolesDir,
      verbose: true,
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Role file:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Interval: 60s'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Max turns: 5'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Permission mode: acceptEdits'));

    startSpy.mockRestore();
    stopSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('shutdownハンドラがdaemon.stop()とunmount()を呼ぶ', async () => {
    const { mockQuery } = await import('../../../helpers/mock-agent-sdk.js');
    mockQuery([]);

    const { Daemon } = await import('../../../../src/daemon/daemon.js');
    const startSpy = spyOn(Daemon.prototype, 'start').mockResolvedValue(undefined);
    const stopSpy = spyOn(Daemon.prototype, 'stop').mockResolvedValue(undefined);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    // Capture the SIGINT handler
    let sigintHandler: Function | null = null;
    const onSpy = spyOn(process, 'on').mockImplementation((event: string, handler: any) => {
      if (event === 'SIGINT') sigintHandler = handler;
      return process;
    });

    const { startAction } = await import('../../../../src/cli/commands/start.js');

    const tempDir = mkdtempSync(join(tmpdir(), 'devdemon-start-'));
    const rolesDir = mkdtempSync(join(tmpdir(), 'devdemon-roles-'));
    writeFileSync(
      join(rolesDir, 'test.md'),
      '---\nname: ShutdownTest\ninterval: 60\nmaxTurns: 5\npermissionMode: acceptEdits\n---\nBody',
    );

    await startAction({
      role: 'test',
      repo: tempDir,
      rolesDir,
    });

    expect(sigintHandler).not.toBeNull();
    // Call the shutdown handler
    await sigintHandler!();
    expect(stopSpy).toHaveBeenCalled();

    startSpy.mockRestore();
    stopSpy.mockRestore();
    logSpy.mockRestore();
    onSpy.mockRestore();
  });

  test('SIGINTハンドラが登録される', async () => {
    const { mockQuery } = await import('../../../helpers/mock-agent-sdk.js');
    mockQuery([]);

    const { Daemon } = await import('../../../../src/daemon/daemon.js');
    const startSpy = spyOn(Daemon.prototype, 'start').mockResolvedValue(undefined);
    const stopSpy = spyOn(Daemon.prototype, 'stop').mockResolvedValue(undefined);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const onSpy = spyOn(process, 'on');

    const { startAction } = await import('../../../../src/cli/commands/start.js');

    const tempDir = mkdtempSync(join(tmpdir(), 'devdemon-start-'));
    const rolesDir = mkdtempSync(join(tmpdir(), 'devdemon-roles-'));
    writeFileSync(
      join(rolesDir, 'test.md'),
      '---\nname: SigTest\ninterval: 60\nmaxTurns: 5\npermissionMode: acceptEdits\n---\nBody',
    );

    await startAction({
      role: 'test',
      repo: tempDir,
      rolesDir,
    });

    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    startSpy.mockRestore();
    stopSpy.mockRestore();
    logSpy.mockRestore();
    onSpy.mockRestore();
  });
});
