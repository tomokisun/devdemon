import { describe, test, expect, afterEach } from 'bun:test';
import { existsSync, rmSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { Logger, type LogEntry } from '../../../src/utils/logger.js';

describe('Logger', () => {
  let logFile: string;
  let testDir: string;

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  function setup(): Logger {
    testDir = join(tmpdir(), `devdemon-logger-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    logFile = join(testDir, 'test.log');
    return new Logger(logFile);
  }

  function readEntries(): LogEntry[] {
    const content = readFileSync(logFile, 'utf-8').trim();
    return content.split('\n').map(line => JSON.parse(line));
  }

  test('info レベルでログを書き出す', () => {
    const logger = setup();
    logger.info('test info message');
    const entries = readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('test info message');
  });

  test('warn レベルでログを書き出す', () => {
    const logger = setup();
    logger.warn('test warn message');
    const entries = readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('warn');
    expect(entries[0].message).toBe('test warn message');
  });

  test('error レベルでログを書き出す', () => {
    const logger = setup();
    logger.error('test error message');
    const entries = readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('error');
    expect(entries[0].message).toBe('test error message');
  });

  test('ISO8601タイムスタンプが付与される', () => {
    const logger = setup();
    logger.info('timestamp check');
    const entries = readEntries();
    const ts = entries[0].timestamp;
    // ISO8601 format check
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  test('構造化データをJSON形式で記録する', () => {
    const logger = setup();
    logger.info('with data', { count: 42, tags: ['a', 'b'] });
    const entries = readEntries();
    expect(entries[0].data).toEqual({ count: 42, tags: ['a', 'b'] });
  });
});
