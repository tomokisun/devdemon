import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { WelcomeScreen } from '../../../src/ui/components/welcome-screen.js';
import type { RoleConfig } from '../../../src/roles/types.js';
import type { DevDemonStats } from '../../../src/state/types.js';

const mockRole: RoleConfig = {
  frontmatter: {
    name: 'swe',
    description: 'Software Engineer',
    interval: 300,
    maxTurns: 25,
    permissionMode: 'acceptEdits',
  },
  body: '# SWE Role',
  filePath: '/path/to/swe.md',
};

const mockRoles: RoleConfig[] = [
  mockRole,
  {
    frontmatter: {
      name: 'pm',
      description: 'Project Manager',
      interval: 600,
      maxTurns: 10,
      permissionMode: 'default',
    },
    body: '# PM Role',
    filePath: '/path/to/pm.md',
  },
  {
    frontmatter: {
      name: 'reviewer',
      description: 'Code Reviewer',
      interval: 120,
      maxTurns: 15,
      permissionMode: 'acceptEdits',
    },
    body: '# Reviewer Role',
    filePath: '/path/to/reviewer.md',
  },
];

const mockStats: DevDemonStats = {
  totalCycles: 15,
  totalCostUsd: 0.42,
  totalTasks: 13,
  userTasks: 5,
  autonomousTasks: 8,
  failedTasks: 1,
};

const defaultProps = {
  role: mockRole,
  roles: mockRoles,
  repoPath: '/home/user/my-project',
  stats: mockStats,
  version: '0.1.0',
};

describe('WelcomeScreen', () => {
  test('DevDemonバージョンが表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    const frame = lastFrame()!;
    expect(frame).toContain('DevDemon');
    expect(frame).toContain('0.1.0');
  });

  test('ウェルカムメッセージが表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    expect(lastFrame()).toContain('Welcome back!');
  });

  test('デーモンのASCIIアートが表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    const frame = lastFrame()!;
    // Check for parts of the ASCII art
    const hasAsciiArt = frame.includes('o.o') || frame.includes('> ^ <');
    expect(hasAsciiArt).toBe(true);
  });

  test('アクティブロールの名前と説明が表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    const frame = lastFrame()!;
    expect(frame).toContain('swe');
    expect(frame).toContain('Software Engineer');
  });

  test('ロール設定の詳細が表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    const frame = lastFrame()!;
    expect(frame).toContain('300');
    expect(frame).toContain('25');
    expect(frame).toContain('acceptEdits');
  });

  test('利用可能なロール一覧が表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    const frame = lastFrame()!;
    expect(frame).toContain('swe');
    expect(frame).toContain('pm');
    expect(frame).toContain('reviewer');
  });

  test('前回セッションの統計情報が表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    const frame = lastFrame()!;
    expect(frame).toContain('15');
    expect(frame).toContain('$0.42');
    expect(frame).toContain('1');
  });

  test('統計情報がnullの場合は「No previous session」と表示される', () => {
    const { lastFrame } = render(
      <WelcomeScreen {...defaultProps} stats={null} />
    );
    expect(lastFrame()).toContain('No previous session');
  });

  test('リポジトリ名が表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    expect(lastFrame()).toContain('my-project');
  });

  test('claude-agent-sdkの情報が表示される', () => {
    const { lastFrame } = render(<WelcomeScreen {...defaultProps} />);
    expect(lastFrame()).toContain('claude-agent-sdk');
  });

  test('ロールが1つだけの場合も正常にレンダリングされる', () => {
    const { lastFrame } = render(
      <WelcomeScreen {...defaultProps} roles={[mockRole]} />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('swe');
  });

  test('エラーなしでレンダリングされる', () => {
    expect(() => {
      render(<WelcomeScreen {...defaultProps} />);
    }).not.toThrow();
  });
});
