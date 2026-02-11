import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from '../../../src/ui/components/header.js';

describe('Header', () => {
  test('DevDemonブランド名を表示する', () => {
    const { lastFrame } = render(
      <Header roleName="reviewer" repoPath="/home/user/my-repo" cycle={1} />
    );
    expect(lastFrame()).toContain('DevDemon');
  });

  test('ロール名を表示する', () => {
    const { lastFrame } = render(
      <Header roleName="reviewer" repoPath="/home/user/my-repo" cycle={1} />
    );
    expect(lastFrame()).toContain('reviewer');
  });

  test('リポジトリのbasenameを表示する', () => {
    const { lastFrame } = render(
      <Header roleName="reviewer" repoPath="/home/user/my-repo" cycle={1} />
    );
    expect(lastFrame()).toContain('my-repo');
  });

  test('サイクル番号を表示する', () => {
    const { lastFrame } = render(
      <Header roleName="reviewer" repoPath="/home/user/my-repo" cycle={42} />
    );
    expect(lastFrame()).toContain('#42');
  });
});
