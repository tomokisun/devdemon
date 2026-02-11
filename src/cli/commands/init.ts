import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

interface InitOptions {
  role?: string;
}

const ROLE_TEMPLATE = (name: string) => `---
name: ${name}
interval: 300
maxTurns: 25
permissionMode: acceptEdits
description: ""
---

`;

export const initCommand = new Command('init')
  .description('Initialize DevDemon in the current directory')
  .option('-r, --role <name>', 'Create a custom role template')
  .action((options: InitOptions) => {
    const cwd = process.cwd();
    const devdemonDir = resolve(cwd, '.devdemon');

    if (existsSync(devdemonDir)) {
      console.log('Already initialized: .devdemon/ directory exists.');
    } else {
      mkdirSync(devdemonDir, { recursive: true });
      console.log('Created .devdemon/ directory.');
    }

    if (options.role) {
      const rolesDir = resolve(cwd, 'roles');
      mkdirSync(rolesDir, { recursive: true });
      const rolePath = join(rolesDir, `${options.role}.md`);

      if (existsSync(rolePath)) {
        console.log(`Role file already exists: ${rolePath}`);
      } else {
        writeFileSync(rolePath, ROLE_TEMPLATE(options.role), 'utf-8');
        console.log(`Created role template: ${rolePath}`);
      }
    }
  });
