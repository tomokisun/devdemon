import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { DEVDEMON_DIR_NAME } from '../../constants.js';

export const initCommand = new Command('init')
  .description('Initialize DevDemon in the current directory')
  .action(() => {
    const cwd = process.cwd();
    const devdemonDir = resolve(cwd, DEVDEMON_DIR_NAME);

    const dirExisted = existsSync(devdemonDir);

    if (!dirExisted) {
      mkdirSync(devdemonDir, { recursive: true });
      console.log('Created .devdemon/ directory.');
    }

    const settingsPath = resolve(devdemonDir, 'settings.json');

    if (!existsSync(settingsPath)) {
      const template = JSON.stringify({ language: '', model: '' }, null, 2);
      writeFileSync(settingsPath, template + '\n');
      console.log('Created .devdemon/settings.json template.');
    } else if (dirExisted) {
      console.log('Already initialized: .devdemon/ directory exists.');
    }
  });
