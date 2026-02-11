import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { rolesCommand } from './commands/roles.js';
import { initCommand } from './commands/init.js';

export const program = new Command()
  .name('devdemon')
  .version('0.1.0')
  .description('Autonomous AI agent daemon powered by Claude Code');

program.addCommand(startCommand);
program.addCommand(rolesCommand);
program.addCommand(initCommand);
