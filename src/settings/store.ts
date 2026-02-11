import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { DevDemonSettings } from './types.js';
import { validateSettings } from './types.js';

export class SettingsStore {
  private settings: DevDemonSettings;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.settings = this.load();
  }

  get(): DevDemonSettings {
    return { ...this.settings };
  }

  getModel(): string | undefined {
    return this.settings.model;
  }

  getLanguage(): string | undefined {
    return this.settings.language;
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
    } catch {
      // Silently fail if unable to persist
    }
  }

  private load(): DevDemonSettings {
    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return validateSettings(parsed);
    } catch {
      return {};
    }
  }
}
