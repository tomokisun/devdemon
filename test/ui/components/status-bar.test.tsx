import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../../../src/ui/components/status-bar.js';

describe('StatusBar', () => {
  test('キューの深さを表示する', () => {
    const { lastFrame } = render(
      <StatusBar queueLength={5} totalCostUsd={1.5} startedAt={new Date().toISOString()} />
    );
    expect(lastFrame()).toContain('5');
  });

  test('コストをドル形式で表示する', () => {
    const { lastFrame } = render(
      <StatusBar queueLength={0} totalCostUsd={3.14} startedAt={new Date().toISOString()} />
    );
    expect(lastFrame()).toContain('$3.14');
  });

  test('稼働時間を表示する', () => {
    // Set start to 2 hours 30 minutes ago
    const start = new Date(Date.now() - 2 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString();
    const { lastFrame } = render(
      <StatusBar queueLength={0} totalCostUsd={0} startedAt={start} />
    );
    expect(lastFrame()).toContain('2h 30m');
  });

  test('Queue, Cost, Uptimeラベルを表示する', () => {
    const { lastFrame } = render(
      <StatusBar queueLength={0} totalCostUsd={0} startedAt={new Date().toISOString()} />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Queue');
    expect(frame).toContain('Cost');
    expect(frame).toContain('Uptime');
  });
});
