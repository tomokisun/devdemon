import { Command } from 'commander';
import { resolveRolesDir, loadAllRoles } from '../../roles/loader.js';
import type { RoleConfig } from '../../roles/types.js';

interface RolesOptions {
  rolesDir?: string;
}

function printRoleTable(roles: RoleConfig[]): void {
  const nameWidth = Math.max(
    'NAME'.length,
    ...roles.map(r => r.frontmatter.name.length),
  );
  const descWidth = Math.max(
    'DESCRIPTION'.length,
    ...roles.map(r => (r.frontmatter.description ?? '').length),
  );

  const header = `${'NAME'.padEnd(nameWidth)}  ${'DESCRIPTION'.padEnd(descWidth)}`;
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const role of roles) {
    const name = role.frontmatter.name.padEnd(nameWidth);
    const desc = (role.frontmatter.description ?? '').padEnd(descWidth);
    console.log(`${name}  ${desc}`);
  }
}

function showRoleDetail(role: RoleConfig): void {
  const fm = role.frontmatter;
  console.log(`Name:            ${fm.name}`);
  console.log(`Interval:        ${fm.interval}s`);
  console.log(`Max Turns:       ${fm.maxTurns}`);
  console.log(`Permission Mode: ${fm.permissionMode}`);
  if (fm.description) {
    console.log(`Description:     ${fm.description}`);
  }
  if (fm.tools && fm.tools.length > 0) {
    console.log(`Tools:           ${fm.tools.join(', ')}`);
  }
  if (fm.tags && fm.tags.length > 0) {
    console.log(`Tags:            ${fm.tags.join(', ')}`);
  }
  console.log(`File:            ${role.filePath}`);
  console.log('');
  console.log('--- Body ---');
  console.log(role.body);
}

export const rolesCommand = new Command('roles')
  .description('Manage and inspect roles')
  .option('--roles-dir <path>', 'Custom roles directory');

rolesCommand
  .command('list')
  .description('List all available roles')
  .action(() => {
    const opts = rolesCommand.opts<RolesOptions>();
    const rolesDir = resolveRolesDir({ rolesDir: opts.rolesDir });
    const roles = loadAllRoles(rolesDir);

    if (roles.length === 0) {
      console.log('No roles found. Run "devdemon init --role <name>" to create one.');
      return;
    }

    printRoleTable(roles);
  });

rolesCommand
  .command('show <name>')
  .description('Show detailed information about a role')
  .action((name: string) => {
    const opts = rolesCommand.opts<RolesOptions>();
    const rolesDir = resolveRolesDir({ rolesDir: opts.rolesDir });
    const roles = loadAllRoles(rolesDir);
    const role = roles.find(
      r => r.frontmatter.name.toLowerCase() === name.toLowerCase()
        || r.filePath.endsWith(`/${name}.md`),
    );

    if (!role) {
      console.error(`Error: Role "${name}" not found.`);
      const available = roles.map(r => r.frontmatter.name).join(', ');
      if (available) {
        console.error(`Available roles: ${available}`);
      }
      process.exit(1);
    }

    showRoleDetail(role);
  });
