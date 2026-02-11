import { describe, test, expect, mock, spyOn } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import type { RoleConfig } from '../../../../src/roles/types.js';
import {
  formatRoleMenu,
  selectRole,
  resolveRoleWithSelector,
  selectRoleInk,
} from '../../../../src/cli/commands/role-selection.js';

const FIXTURES_DIR = resolve(import.meta.dir, '../../../fixtures/roles');

function makeRole(name: string, description?: string, filePath?: string): RoleConfig {
  return {
    frontmatter: {
      name,
      interval: 300,
      maxTurns: 50,
      permissionMode: 'acceptEdits',
      ...(description ? { description } : {}),
    },
    body: `# ${name}`,
    filePath: filePath ?? `/roles/${name.toLowerCase().replace(/\s+/g, '-')}.md`,
  };
}

describe('resolveRoleWithSelector', () => {
  test('rolesDirオプション指定時にrolesDir内のロールを使用する', async () => {
    const selector = mock(async (roles: RoleConfig[]) => roles[0]);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const result = await resolveRoleWithSelector(
      { rolesDir: FIXTURES_DIR },
      selector,
    );

    expect(result.role).toBeDefined();
    expect(result.allRoles.length).toBeGreaterThan(0);
    logSpy.mockRestore();
  });

  test('rolesDirなしの場合はbuiltinとprojectロールを結合する', async () => {
    const selector = mock(async (roles: RoleConfig[]) => roles[0]);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const result = await resolveRoleWithSelector({}, selector);

    expect(result.role).toBeDefined();
    expect(result.allRoles.length).toBeGreaterThan(0);
    logSpy.mockRestore();
  });

  test('--role指定時にrolesDir内から名前で検索する', async () => {
    const selector = mock(async (roles: RoleConfig[]) => roles[0]);

    const result = await resolveRoleWithSelector(
      { role: 'valid-swe', rolesDir: FIXTURES_DIR },
      selector,
    );

    expect(result.role.frontmatter.name).toBe('Software Engineer');
    // selector should not be called when role is specified directly
    expect(selector).not.toHaveBeenCalled();
  });

  test('--role指定時にrolesDir内でファイルが見つからない場合はprocess.exitする', async () => {
    const selector = mock(async (roles: RoleConfig[]) => roles[0]);
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    try {
      await resolveRoleWithSelector(
        { role: 'nonexistent-role', rolesDir: FIXTURES_DIR },
        selector,
      );
    } catch {
      // expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error: Role "nonexistent-role" not found'),
    );

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('--role指定でrolesDir未指定時にfilePathで検索する', async () => {
    const selector = mock(async (roles: RoleConfig[]) => roles[0]);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    // Use an existing builtin role that loadAllRolesGrouped would find
    const result = await resolveRoleWithSelector(
      { role: 'swe' },
      selector,
    );

    expect(result.role).toBeDefined();
    expect(result.role.filePath).toContain('/swe.md');
    logSpy.mockRestore();
  });

  test('--role指定でrolesDir未指定時に見つからない場合はprocess.exitする', async () => {
    const selector = mock(async (roles: RoleConfig[]) => roles[0]);
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    try {
      await resolveRoleWithSelector(
        { role: 'absolutely-nonexistent-xyz' },
        selector,
      );
    } catch {
      // expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error: Role "absolutely-nonexistent-xyz" not found'),
    );

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('selectRoleInk', () => {
  test('ロールが0件の場合はprocess.exitする', async () => {
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    try {
      await selectRoleInk([]);
    } catch {
      // expected
    }

    expect(errorSpy).toHaveBeenCalledWith('No roles found.');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('ロールが1件の場合はそのロールを自動的に返す', async () => {
    const role = makeRole('Solo');
    const result = await selectRoleInk([role]);
    expect(result).toBe(role);
  });

  test('複数ロールの場合はInk UIをレンダリングして選択を待つ', async () => {
    // We need to mock ink's render to avoid actual terminal rendering
    // The function creates an Ink App component with roles and onRoleSelected callback
    const roles = [makeRole('swe'), makeRole('reviewer')];

    // Mock ink's render to immediately call onRoleSelected
    const inkModule = await import('ink');
    const originalRender = inkModule.render;
    const mockUnmount = mock(() => {});
    const mockCleanup = mock(() => {});

    // Patch render to capture props and auto-select
    const renderSpy = spyOn(inkModule, 'render').mockImplementation((element: any, options?: any) => {
      // Extract the onRoleSelected callback from the element's props
      const props = element.props;
      if (props && props.onRoleSelected) {
        // Simulate selecting the first role
        setTimeout(() => props.onRoleSelected(roles[0]), 10);
      }
      return {
        unmount: mockUnmount,
        cleanup: mockCleanup,
        rerender: mock(() => {}),
        waitUntilExit: mock(() => Promise.resolve()),
        clear: mock(() => {}),
      } as any;
    });

    const result = await selectRoleInk(roles);

    expect(result).toBe(roles[0]);
    expect(renderSpy).toHaveBeenCalled();
    expect(mockUnmount).toHaveBeenCalled();
    expect(mockCleanup).toHaveBeenCalled();

    renderSpy.mockRestore();
  });
});
