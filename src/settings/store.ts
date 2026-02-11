import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { DevDemonSettings } from './types.js';
import { validateSettings } from './types.js';
import { Logger } from '../utils/logger.js';

export class SettingsStore {
  private settings: DevDemonSettings;
  private readonly filePath: string;
  private readonly logger = new Logger();

  constructor(filePath: string) {
    this.filePath = filePath;
    this.settings = this.load();
  }

  get(): DevDemonSettings {
    return { ...this.settings };
  }

  set(key: keyof DevDemonSettings, value: string): void {
    this.settings[key] = value;
    this.save();
  }

  remove(key: keyof DevDemonSettings): void {
    delete this.settings[key];
    this.save();
  }

  save(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      this.logger.error('Failed to save settings', { path: this.filePath, error: String(error) });
    }
  }

  private load(): DevDemonSettings {
    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return validateSettings(parsed);
    } catch (error) {
      this.logger.warn('Failed to load settings, using defaults', { path: this.filePath, error: String(error) });
      return {};
    }
  }
}
