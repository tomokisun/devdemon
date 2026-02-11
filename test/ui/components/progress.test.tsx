import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { Progress } from '../../../src/ui/components/progress.js';

describe('Progress', () => {
  test('メッセージを表示する', () => {
    const { lastFrame } = render(
      <Progress messages={['Running task...', 'Processing files...']} />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Running task...');
    expect(frame).toContain('Processing files...');
  });

  test('メッセージが空の場合は何も表示しない', () => {
    const { lastFrame } = render(<Progress messages={[]} />);
    expect(lastFrame()).toBe('');
  });
});
