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

describe('App - welcome screen phase', () => {
  test('showWelcomeでdaemon未設定の場合はWelcomeScreenを表示する', () => {
    const role = makeRole('swe', 'Software engineer');
    const allRoles = [role, makeRole('reviewer')];
    const { lastFrame } = render(
      React.createElement(App, {
        showWelcome: true,
        selectedRole: role,
        allRoles,
        repoPath: '/home/user/project',
        previousStats: null,
        version: '0.1.0',
      })
    );
    const frame = lastFrame()!;
    expect(frame).toContain('swe');
  });

  test('previousStatsがnullの場合もWelcomeScreenを表示する', () => {
    const role = makeRole('swe', 'Software engineer');
    const allRoles = [role];
    const { lastFrame } = render(
      React.createElement(App, {
        showWelcome: true,
        selectedRole: role,
        allRoles,
        repoPath: '/tmp/project',
        previousStats: null,
        version: '1.0.0',
      })
    );
    expect(lastFrame()).not.toBe('');
  });

  test('previousStatsを含む場合もWelcomeScreenを表示する', () => {
    const role = makeRole('swe', 'Software engineer');
    const allRoles = [role];
    const stats = {
      totalCycles: 10,
      totalCostUsd: 1.5,
      totalTasks: 8,
      userTasks: 3,
      autonomousTasks: 5,
      failedTasks: 0,
    };
    const { lastFrame } = render(
      React.createElement(App, {
        showWelcome: true,
        selectedRole: role,
        allRoles,
        repoPath: '/tmp/project',
        previousStats: stats,
        version: '0.1.0',
      })
    );
    expect(lastFrame()).not.toBe('');
  });

  test('showWelcome + daemon で DaemonContent を含む表示になる', () => {
    const daemon = createMockDaemon();
    const role = makeRole('swe', 'Software engineer');
    const allRoles = [role];
    const onQuit = mock(() => {});
    const { lastFrame } = render(
      React.createElement(App, {
        daemon,
        onQuit,
        showWelcome: true,
        selectedRole: role,
        allRoles,
        repoPath: '/home/user/project',
        previousStats: null,
        version: '0.1.0',
      })
    );
    const frame = lastFrame()!;
    // Should show both welcome content and daemon content (queue, cost, etc.)
    expect(frame).toContain('Queue');
  });
});
