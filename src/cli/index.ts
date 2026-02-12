import { Command } from 'commander';
import { startAction } from './commands/start.js';
import { rolesCommand } from './commands/roles.js';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';

export const program = new Command()
  .name('devdemon')
  .version('0.1.0')
  .description('Autonomous AI agent daemon powered by Claude Code')
  .option('-r, --role <name>', 'Role name to use')
  .option('--repo <path>', 'Repository path to work on')
  .option('--roles-dir <path>', 'Custom roles directory')
  .option('-i, --interval <seconds>', 'Override interval in seconds')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--dry-run', 'Render UI without starting daemon (for testing)')
  .option('-p, --print <prompt>', 'Run a single prompt non-interactively and print the result')
  .option('--output-format <format>', 'Output format: text, json, or stream-json (default: text)')
  .option('--max-turns <n>', 'Override max turns from role')
  .option('--allowed-tools <tools>', 'Override allowed tools (comma-separated)')
  .option('--system-prompt <prompt>', 'Override system prompt')
  .option('--append-system-prompt <prompt>', 'Append to system prompt')
  .action(async (options) => {
    if (options.print) {
      const { printAction } = await import('./commands/print.js');
      await printAction(options);
    } else {
      await startAction(options);
    }
  });

program.addCommand(rolesCommand);
program.addCommand(initCommand);
program.addCommand(configCommand);
