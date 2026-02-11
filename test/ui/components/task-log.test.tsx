import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { TaskLog, type TaskLogEntry } from '../../../src/ui/components/task-log.js';

describe('TaskLog', () => {
  test('エントリがない場合は空メッセージを表示する', () => {
    const { lastFrame } = render(<TaskLog entries={[]} />);
    expect(lastFrame()).toContain('No tasks yet');
  });

  test('completedタスクに✓を表示する', () => {
    const entries: TaskLogEntry[] = [
      { id: '1', status: 'completed', prompt: 'Fix bug', timestamp: '2025-01-01T10:30:00Z' },
    ];
    const { lastFrame } = render(<TaskLog entries={entries} />);
    expect(lastFrame()).toContain('✓');
  });

  test('failedタスクに✗を表示する', () => {
    const entries: TaskLogEntry[] = [
      { id: '1', status: 'failed', prompt: 'Deploy app', timestamp: '2025-01-01T11:00:00Z' },
    ];
    const { lastFrame } = render(<TaskLog entries={entries} />);
    expect(lastFrame()).toContain('✗');
  });

  test('runningタスクに⟳を表示する', () => {
    const entries: TaskLogEntry[] = [
      { id: '1', status: 'running', prompt: 'Run tests', timestamp: '2025-01-01T12:00:00Z' },
    ];
    const { lastFrame } = render(<TaskLog entries={entries} />);
    expect(lastFrame()).toContain('⟳');
  });

  test('[HH:MM]タイムスタンプを表示する', () => {
    const entries: TaskLogEntry[] = [
      { id: '1', status: 'completed', prompt: 'Fix bug', timestamp: '2025-01-01T14:05:00Z' },
    ];
    const { lastFrame } = render(<TaskLog entries={entries} />);
    const frame = lastFrame()!;
    // Check that the time is displayed in [HH:MM] format (local time zone)
    expect(frame).toMatch(/\[\d{2}:\d{2}\]/);
  });

  test('長いプロンプトを切り詰める', () => {
    const longPrompt = 'A'.repeat(80);
    const entries: TaskLogEntry[] = [
      { id: '1', status: 'completed', prompt: longPrompt, timestamp: '2025-01-01T10:00:00Z' },
    ];
    const { lastFrame } = render(<TaskLog entries={entries} />);
    const frame = lastFrame()!;
    expect(frame).toContain('…');
    expect(frame).not.toContain(longPrompt);
  });

  test('複数のエントリを順番に表示する', () => {
    const entries: TaskLogEntry[] = [
      { id: '1', status: 'completed', prompt: 'First task', timestamp: '2025-01-01T10:00:00Z' },
      { id: '2', status: 'failed', prompt: 'Second task', timestamp: '2025-01-01T11:00:00Z' },
      { id: '3', status: 'running', prompt: 'Third task', timestamp: '2025-01-01T12:00:00Z' },
    ];
    const { lastFrame } = render(<TaskLog entries={entries} />);
    const frame = lastFrame()!;
    expect(frame).toContain('First task');
    expect(frame).toContain('Second task');
    expect(frame).toContain('Third task');
  });
});
