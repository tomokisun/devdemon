import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { RoleSelector } from '../../../src/ui/components/role-selector.js';
import type { RoleConfig } from '../../../src/roles/types.js';

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

describe('RoleSelector', () => {
  test('ヘッダー "Select a role:" が表示される', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe'), makeRole('reviewer')];
    const { lastFrame } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    expect(lastFrame()).toContain('Select a role:');
  });

  test('全ロール名が番号付きで表示される', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe'), makeRole('reviewer'), makeRole('tester')];
    const { lastFrame } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    expect(lastFrame()).toContain('1.');
    expect(lastFrame()).toContain('swe');
    expect(lastFrame()).toContain('2.');
    expect(lastFrame()).toContain('reviewer');
    expect(lastFrame()).toContain('3.');
    expect(lastFrame()).toContain('tester');
  });

  test('descriptionがある場合は表示される', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe', 'Software engineer role')];
    const { lastFrame } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    expect(lastFrame()).toContain('swe');
    expect(lastFrame()).toContain('Software engineer role');
  });

  test('descriptionがない場合は名前のみ表示される', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe')];
    const { lastFrame } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    expect(lastFrame()).toContain('swe');
    expect(lastFrame()).not.toContain(' - ');
  });

  test('有効な番号キーを押すとonSelectが正しいロールで呼ばれる', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe'), makeRole('reviewer'), makeRole('tester')];
    const { stdin } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    stdin.write('2');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(roles[1]);
  });

  test('最初のロールを選択できる', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe'), makeRole('reviewer')];
    const { stdin } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    stdin.write('1');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(roles[0]);
  });

  test('0を押してもonSelectが呼ばれない', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe'), makeRole('reviewer')];
    const { stdin } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    stdin.write('0');
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('ロール数を超える番号を押してもonSelectが呼ばれない', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe'), makeRole('reviewer')];
    const { stdin } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    stdin.write('5');
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('数字以外のキーを押してもonSelectが呼ばれない', () => {
    const onSelect = mock(() => {});
    const roles = [makeRole('swe'), makeRole('reviewer')];
    const { stdin } = render(
      React.createElement(RoleSelector, { roles, onSelect })
    );
    stdin.write('a');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
