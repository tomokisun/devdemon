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
  .action(startAction);

program.addCommand(rolesCommand);
program.addCommand(initCommand);
program.addCommand(configCommand);
