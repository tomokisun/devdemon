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

  test('modelが指定された場合にモデル名を表示する', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
        model="claude-sonnet-4-20250514"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('claude-sonnet-4-20250514');
  });

  test('modelが未指定の場合はモデル名を表示しない', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
      />
    );
    const frame = lastFrame()!;
    expect(frame).not.toContain('claude-sonnet');
  });

  test('permissionModeが指定された場合に表示する', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
        permissionMode="bypassPermissions"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('bypass permissions on');
  });

  test('permissionMode=acceptEditsの場合にaccept editsラベルを表示する', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
        permissionMode="acceptEdits"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('accept edits');
  });

  test('gitBranchが指定された場合にブランチ名を表示する', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
        gitBranch="feature/my-branch"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('git:');
    expect(frame).toContain('feature/my-branch');
  });

  test('gitBranchが未指定の場合はgitラベルを表示しない', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
      />
    );
    const frame = lastFrame()!;
    expect(frame).not.toContain('git:');
  });

  test('全オプションが指定された場合にすべて表示する', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={3}
        totalCostUsd={2.50}
        startedAt={new Date().toISOString()}
        model="claude-sonnet-4-20250514"
        permissionMode="acceptEdits"
        gitBranch="main"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('claude-sonnet-4-20250514');
    expect(frame).toContain('accept edits');
    expect(frame).toContain('git:');
    expect(frame).toContain('main');
    expect(frame).toContain('3');
    expect(frame).toContain('$2.50');
  });

  test('fileStatsが指定された場合にファイル変更数と追加・削除行数を表示する', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
        fileStats={{ filesChanged: 8, insertions: 775, deletions: 1232 }}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('8 files');
    expect(frame).toContain('+775');
    expect(frame).toContain('-1232');
  });

  test('fileStats=1ファイルの場合に単数形fileを使う', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
        fileStats={{ filesChanged: 1, insertions: 10, deletions: 3 }}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('1 file ');
    expect(frame).not.toContain('1 files');
  });

  test('fileStatsが0変更の場合はファイル統計を表示しない', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
        fileStats={{ filesChanged: 0, insertions: 0, deletions: 0 }}
      />
    );
    const frame = lastFrame()!;
    expect(frame).not.toContain('file');
  });

  test('fileStatsがnullの場合はファイル統計を表示しない', () => {
    const { lastFrame } = render(
      <StatusBar
        queueLength={0}
        totalCostUsd={0}
        startedAt={new Date().toISOString()}
        fileStats={null}
      />
    );
    const frame = lastFrame()!;
    expect(frame).not.toContain('+');
    expect(frame).not.toContain('file');
  });
});
