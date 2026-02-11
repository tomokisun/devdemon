import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getLogPath } from './paths.js';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

export class Logger {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? getLogPath();
  }

  info(message: string, data?: unknown): void {
    this.write('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.write('error', message, data);
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data !== undefined ? { data } : {}),
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    appendFileSync(this.filePath, JSON.stringify(entry) + '\n');
  }
}
