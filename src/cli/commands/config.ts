import { Command } from 'commander';
import { SettingsStore } from '../../settings/store.js';
import { getSettingsPath } from '../../utils/paths.js';
import type { DevDemonSettings } from '../../settings/types.js';

const VALID_KEYS: (keyof DevDemonSettings)[] = ['language', 'model'];

function validateKey(key: string): asserts key is keyof DevDemonSettings {
  if (!VALID_KEYS.includes(key as keyof DevDemonSettings)) {
    console.error(`Error: Unknown setting "${key}". Valid keys: ${VALID_KEYS.join(', ')}`);
    process.exit(1);
  }
}

export const configCommand = new Command('config')
  .description('Manage devdemon settings');

configCommand
  .command('list')
  .description('Display all current settings')
  .action(function (this: Command) {
    const repoPath: string = this.parent?.parent?.opts()?.repo ?? process.cwd();
    const store = new SettingsStore(getSettingsPath(repoPath));
    const settings = store.get();

    const maxKeyLen = Math.max(...VALID_KEYS.map(k => k.length));

    for (const key of VALID_KEYS) {
      const value = settings[key];
      const display = value !== undefined ? String(value) : '(not set)';
      console.log(`${key.padEnd(maxKeyLen)} = ${display}`);
    }
  });

configCommand
  .command('set <key> <value>')
  .description('Set a setting value')
  .action(function (this: Command, key: string, value: string) {
    validateKey(key);
    const repoPath: string = this.parent?.parent?.opts()?.repo ?? process.cwd();
    const store = new SettingsStore(getSettingsPath(repoPath));
    store.set(key, value);
    console.log(`Set ${key} = ${value}`);
  });

configCommand
  .command('get <key>')
  .description('Get a setting value')
  .action(function (this: Command, key: string) {
    validateKey(key);
    const repoPath: string = this.parent?.parent?.opts()?.repo ?? process.cwd();
    const store = new SettingsStore(getSettingsPath(repoPath));
    const settings = store.get();
    const value = settings[key];
    const display = value !== undefined ? String(value) : '(not set)';
    console.log(display);
  });
