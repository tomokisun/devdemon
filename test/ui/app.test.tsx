import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { EventEmitter } from 'events';
import { App } from '../../src/ui/app.js';
import type { RoleConfig } from '../../src/roles/types.js';

function createMockDaemon() {
  const daemon = new EventEmitter() as any;
  daemon.agent = new EventEmitter();
  daemon.state = {
    getStats: mock(() => ({
      totalCycles: 3,
      totalCostUsd: 0.42,
      totalTasks: 3,
      userTasks: 1,
      autonomousTasks: 2,
      failedTasks: 0,
    })),
  };
  daemon.queue = { length: 2 };
  daemon.role = {
    frontmatter: { name: 'reviewer', interval: 10, maxTurns: 5, permissionMode: 'acceptEdits' },
    body: '# Reviewer role',
    filePath: '/tmp/reviewer.md',
  };
  daemon.repoPath = '/home/user/my-project';
  daemon.enqueueUserTask = mock(() => ({}));
  return daemon;
}

describe('App', () => {
  test('Headerコンポーネントがレンダリングされる', () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    const { lastFrame } = render(React.createElement(App, { daemon, onQuit }));
    expect(lastFrame()).toContain('DevDemon');
    expect(lastFrame()).toContain('reviewer');
    expect(lastFrame()).toContain('my-project');
  });

  test('TaskLogの初期状態が表示される', () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    const { lastFrame } = render(React.createElement(App, { daemon, onQuit }));
    expect(lastFrame()).toContain('No tasks yet');
  });

  test('StatusBarにqueue長とコスト情報が表示される', () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    const { lastFrame } = render(React.createElement(App, { daemon, onQuit }));
    expect(lastFrame()).toContain('Queue:');
    expect(lastFrame()).toContain('2');
    expect(lastFrame()).toContain('$0.42');
  });

  test('InputBarのプロンプトが表示される', () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    const { lastFrame } = render(React.createElement(App, { daemon, onQuit }));
    expect(lastFrame()).toContain('❯');
  });

  test('サイクル番号が表示される', () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    const { lastFrame } = render(React.createElement(App, { daemon, onQuit }));
    expect(lastFrame()).toContain('#3');
  });

  test('エラーなしでレンダリングされる', () => {
    const daemon = createMockDaemon();
    const onQuit = mock(() => {});
    expect(() => {
      render(React.createElement(App, { daemon, onQuit }));
    }).not.toThrow();
  });
});

function makeRole(name: string, description?: string): RoleConfig {
  return {
    frontmatter: {
      name,
      interval: 300,
      maxTurns: 25,
      permissionMode: 'acceptEdits',
      ...(description ? { description } : {}),
    },
    body: `# ${name}`,
    filePath: `/roles/${name}.md`,
  };
}

describe('App - role selection phase', () => {
  test('roles が渡された場合にロール選択画面が表示される', () => {
    const roles = [makeRole('swe', 'Software engineer'), makeRole('reviewer', 'Code reviewer')];
    const onRoleSelected = mock(() => {});
    const { lastFrame } = render(
      React.createElement(App, { roles, onRoleSelected })
    );
    expect(lastFrame()).toContain('Select a role:');
    expect(lastFrame()).toContain('swe');
    expect(lastFrame()).toContain('reviewer');
  });

  test('daemon が未指定で roles もない場合は何も表示しない', () => {
    const { lastFrame } = render(React.createElement(App, {}));
    expect(lastFrame()).toBe('');
  });

  test('ロール選択でキーを押すとonRoleSelectedが呼ばれる', () => {
    const roles = [makeRole('swe'), makeRole('reviewer')];
    const onRoleSelected = mock(() => {});
    const { stdin } = render(
      React.createElement(App, { roles, onRoleSelected })
    );
    stdin.write('1');
    expect(onRoleSelected).toHaveBeenCalledTimes(1);
    expect(onRoleSelected).toHaveBeenCalledWith(roles[0]);
  });
});
