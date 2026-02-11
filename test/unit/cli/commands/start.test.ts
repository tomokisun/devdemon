import { describe, test, expect } from 'bun:test';
import { Command } from 'commander';

function createStartCommand(): Command {
  return new Command('start')
    .option('-r, --role <name>', 'Role name to use')
    .option('--repo <path>', 'Repository path to work on')
    .option('--roles-dir <path>', 'Custom roles directory')
    .option('-i, --interval <seconds>', 'Override interval in seconds')
    .option('-v, --verbose', 'Enable verbose output')
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
});
