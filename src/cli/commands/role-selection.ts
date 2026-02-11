import { createInterface } from 'readline';
import { render } from 'ink';
import React from 'react';
import { resolveRolesDir, loadAllRoles, loadAllRolesGrouped, loadRole } from '../../roles/loader.js';
import { join } from 'path';
import { App } from '../../ui/app.js';
import type { RoleConfig } from '../../roles/types.js';
import type { StartOptions } from './start.js';

export function formatRoleMenu(roles: RoleConfig[]): string {
  return roles.map((r, i) => {
    const desc = r.frontmatter.description ? ` - ${r.frontmatter.description}` : '';
    return `  ${i + 1}. ${r.frontmatter.name}${desc}`;
  }).join('\n');
}

export async function selectRole(
  roles: RoleConfig[],
  rlFactory?: () => ReturnType<typeof createInterface>,
): Promise<RoleConfig> {
  if (roles.length === 0) {
    console.error('No roles found.');
    process.exit(1);
  }
  if (roles.length === 1) {
    console.log(`Auto-selected role: ${roles[0].frontmatter.name}`);
    return roles[0];
  }

  console.log('\nAvailable roles:');
  console.log(formatRoleMenu(roles));

  const rl = rlFactory
    ? rlFactory()
    : createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question('\nSelect a role (number): ', (answer) => {
      rl.close();
      const index = parseInt(answer, 10) - 1;
      if (index >= 0 && index < roles.length) {
        resolve(roles[index]);
      } else {
        console.error('Invalid selection.');
        process.exit(1);
      }
    });
  });
}

interface ResolvedRoles {
  role: RoleConfig;
  allRoles: RoleConfig[];
}

function loadRolesForOptions(options: StartOptions): { allRoles: RoleConfig[]; rolesDir?: string } {
  if (options.rolesDir) {
    const rolesDir = resolveRolesDir({ rolesDir: options.rolesDir });
    return { allRoles: loadAllRoles(rolesDir), rolesDir };
  }
  const { builtin, project } = loadAllRolesGrouped();
  return { allRoles: [...builtin, ...project] };
}

function findRoleByName(allRoles: RoleConfig[], roleName: string, rolesDir?: string): RoleConfig {
  if (rolesDir) {
    const rolePath = join(rolesDir, `${roleName}.md`);
    try {
      return loadRole(rolePath);
    } catch {
      console.error(`Error: Role "${roleName}" not found in ${rolesDir}`);
      process.exit(1);
    }
  }
  const match = allRoles.find(
    r => r.filePath.endsWith(`/${roleName}.md`),
  );
  if (match) return match;
  console.error(`Error: Role "${roleName}" not found.`);
  process.exit(1);
}

export async function resolveRoleWithSelector(
  options: StartOptions,
  selector: (roles: RoleConfig[]) => Promise<RoleConfig>,
): Promise<ResolvedRoles> {
  const { allRoles, rolesDir } = loadRolesForOptions(options);

  if (options.role) {
    const role = findRoleByName(allRoles, options.role, rolesDir);
    return { role, allRoles };
  }

  const role = await selector(allRoles);
  return { role, allRoles };
}

export async function resolveRole(options: StartOptions): Promise<RoleConfig> {
  const { role } = await resolveRoleWithSelector(options, (roles) => selectRole(roles));
  return role;
}

export async function selectRoleInk(roles: RoleConfig[]): Promise<RoleConfig> {
  if (roles.length === 0) {
    console.error('No roles found.');
    process.exit(1);
  }
  if (roles.length === 1) {
    return roles[0]!;
  }
  return new Promise((resolve) => {
    const { unmount, cleanup } = render(
      React.createElement(App, {
        roles,
        onRoleSelected: (role: RoleConfig) => {
          unmount();
          cleanup();
          resolve(role);
        },
      }),
      { kittyKeyboard: { mode: 'auto' } }
    );
  });
}
