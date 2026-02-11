import type { RoleConfig, RoleFrontmatter } from '../../src/roles/types.js';

export function createTestRole(overrides?: {
  frontmatter?: Partial<RoleFrontmatter>;
  body?: string;
  filePath?: string;
}): RoleConfig {
  return {
    frontmatter: {
      name: 'Test Role',
      interval: 10,
      maxTurns: 5,
      permissionMode: 'acceptEdits' as const,
      ...overrides?.frontmatter,
    },
    body: overrides?.body ?? '# Test Role\nYou are a test role.',
    filePath: overrides?.filePath ?? '/tmp/test-role.md',
  };
}
