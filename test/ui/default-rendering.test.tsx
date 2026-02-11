import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { EventEmitter } from 'events';
import { App } from '../../src/ui/app.js';
import type { RoleConfig } from '../../src/roles/types.js';
import type { DevDemonStats } from '../../src/state/types.js';

function createMockDaemon(roleName = 'swe', repoPath = '/home/user/my-project') {
  const daemon = new EventEmitter() as any;
  daemon.agent = new EventEmitter();
  daemon.state = {
    getStats: mock(() => ({
      totalCycles: 0,
      totalCostUsd: 0,
      totalTasks: 0,
      userTasks: 0,
      autonomousTasks: 0,
      failedTasks: 0,
    })),
  };
  daemon.queue = { length: 0 };
  daemon.role = {
    frontmatter: { name: roleName, description: 'Software Engineer', interval: 300, maxTurns: 25, permissionMode: 'acceptEdits' },
    body: '# SWE role',
    filePath: `/roles/${roleName}.md`,
  };
  daemon.repoPath = repoPath;
  daemon.enqueueUserTask = mock(() => ({}));
  return daemon;
}

function makeRole(name: string, description?: string): RoleConfig {
  return {
    frontmatter: {
      name,
      interval: 300,
      maxTurns: 25,
      permissionMode: 'acceptEdits' as const,
      ...(description ? { description } : {}),
    },
    body: `# ${name}`,
    filePath: `/roles/${name}.md`,
  };
}

const defaultRoles = [
  makeRole('swe', 'Software Engineer'),
  makeRole('reviewer', 'Code Reviewer'),
];

describe('デフォルトUI描画', () => {
  function renderDefaultUI() {
    const daemon = createMockDaemon();
    const result = render(React.createElement(App, {
      daemon,
      onQuit: mock(() => {}),
      showWelcome: true,
      selectedRole: defaultRoles[0],
      allRoles: defaultRoles,
      repoPath: '/home/user/my-project',
      previousStats: null,
      version: '0.1.0',
    }));
    // Capture frame before unmount to avoid leaking React roots across tests
    const frame = result.lastFrame()!;
    result.unmount();
    return { lastFrame: () => frame };
  }

  // === Welcome Screen Structure ===

  test('ウェルカム画面: DevDemonブランド名とバージョンが表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    expect(frame).toContain('DevDemon');
    expect(frame).toContain('0.1.0');
  });

  test('ウェルカム画面: 丸角ボーダーが使用されている', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    const hasRoundBorder = frame.includes('╭') && frame.includes('╰');
    expect(hasRoundBorder).toBe(true);
  });

  test('ウェルカム画面: Welcome back! メッセージが表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('Welcome back!');
  });

  test('ウェルカム画面: デーモンASCIIアートが表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    expect(frame).toContain('o.o');
  });

  test('ウェルカム画面: claude-agent-sdk情報が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('claude-agent-sdk');
  });

  test('ウェルカム画面: リポジトリ名が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('my-project');
  });

  // === Right Panel ===

  test('右パネル: Active Roleセクションが表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    expect(frame).toContain('Active Role');
    expect(frame).toContain('swe');
    expect(frame).toContain('Software Engineer');
  });

  test('右パネル: ロール設定詳細が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    expect(frame).toContain('interval: 300s');
    expect(frame).toContain('maxTurns: 25');
    expect(frame).toContain('acceptEdits');
  });

  test('右パネル: Available Rolesセクションが表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    expect(frame).toContain('Available Roles');
    expect(frame).toContain('swe');
    expect(frame).toContain('reviewer');
  });

  test('右パネル: 統計がない場合は「No previous session」が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('No previous session');
  });

  test('右パネル: セクション間に区切り線が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('────');
  });

  // === Daemon Content Below Welcome Screen ===

  test('タスクログ: 初期状態で「No tasks yet」が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('No tasks yet');
  });

  test('入力バー: プロンプトが表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('❯');
  });

  test('入力バー: 上下にdivider線が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    // The divider lines from InputBar are 80-char dash sequences
    const dividerLines = frame.split('\n').filter(line => {
      const stripped = line.replace(/\s/g, '');
      return stripped.length > 20 && /^─+$/.test(stripped);
    });
    // At least 2 divider lines (above and below input)
    expect(dividerLines.length).toBeGreaterThanOrEqual(2);
  });

  test('ステータスバー: Queue情報が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('Queue:');
  });

  test('ステータスバー: コスト情報が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('$0.00');
  });

  test('ステータスバー: Uptime情報が表示される', () => {
    const { lastFrame } = renderDefaultUI();
    expect(lastFrame()).toContain('Uptime:');
  });

  // === Full Layout Order Test ===

  test('レイアウト順序: ウェルカム画面が入力バーより上に表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    const welcomePos = frame.indexOf('Welcome back!');
    const inputPos = frame.indexOf('❯');
    expect(welcomePos).toBeGreaterThanOrEqual(0);
    expect(inputPos).toBeGreaterThanOrEqual(0);
    expect(welcomePos).toBeLessThan(inputPos);
  });

  test('レイアウト順序: Active Roleがウェルカムメッセージと同じブロック内に表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    const welcomePos = frame.indexOf('Welcome back!');
    const rolePos = frame.indexOf('Active Role');
    const inputPos = frame.indexOf('❯');
    // Both should be in the welcome screen area (before input)
    expect(welcomePos).toBeLessThan(inputPos);
    expect(rolePos).toBeLessThan(inputPos);
  });

  test('レイアウト順序: ステータスバーが入力バーの後に表示される', () => {
    const { lastFrame } = renderDefaultUI();
    const frame = lastFrame()!;
    const statusPos = frame.indexOf('Queue:');
    const inputPos = frame.indexOf('❯');
    // In DaemonContent: TaskLog -> InteractionLog -> InputBar -> StatusBar
    expect(statusPos).toBeGreaterThanOrEqual(0);
    expect(inputPos).toBeGreaterThanOrEqual(0);
    expect(statusPos).toBeGreaterThan(inputPos);
  });

  // === With Previous Stats ===

  test('前回セッション統計がある場合: Stats情報が表示される', () => {
    const daemon = createMockDaemon();
    const stats: DevDemonStats = {
      totalCycles: 10,
      totalCostUsd: 1.23,
      totalTasks: 8,
      userTasks: 3,
      autonomousTasks: 5,
      failedTasks: 2,
    };
    const result = render(React.createElement(App, {
      daemon,
      onQuit: mock(() => {}),
      showWelcome: true,
      selectedRole: defaultRoles[0],
      allRoles: defaultRoles,
      repoPath: '/home/user/my-project',
      previousStats: stats,
      version: '0.1.0',
    }));
    const frame = result.lastFrame()!;
    result.unmount();
    expect(frame).toContain('Stats (last session)');
    expect(frame).toContain('$1.23');
    expect(frame).toContain('10');
  });

  // === Rendering Stability ===

  test('エラーなしでデフォルトUIが完全にレンダリングされる', () => {
    const daemon = createMockDaemon();
    expect(() => {
      const result = render(React.createElement(App, {
        daemon,
        onQuit: mock(() => {}),
        showWelcome: true,
        selectedRole: defaultRoles[0],
        allRoles: defaultRoles,
        repoPath: '/home/user/my-project',
        previousStats: null,
        version: '0.1.0',
      }));
      result.unmount();
    }).not.toThrow();
  });
});
