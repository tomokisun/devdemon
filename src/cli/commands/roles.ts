import { Command } from 'commander';
import { resolveRolesDir, loadAllRoles, loadAllRolesGrouped } from '../../roles/loader.js';
import { getProjectRolesDir } from '../../utils/paths.js';
import { promptRoleFrontmatter } from '../prompts/role-prompts.js';
import { generateRoleBody } from '../generators/role-body-generator.js';
import { writeRole } from '../../roles/writer.js';
import { validateFrontmatter, validateRoleName } from '../../roles/validator.js';
import type { RoleConfig } from '../../roles/types.js';
import type { RlFactory } from '../prompts/role-prompts.js';

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

export async function createRoleAction(
  name: string,
  opts: { rolesDir?: string },
  rlFactory?: RlFactory,
): Promise<void> {
  // Step 0: Validate role name early before interactive prompts
  validateRoleName(name);

  console.log(`\nCreating role: ${name}\n`);

  // Step 1: Interactive prompts
  const rawFrontmatter = await promptRoleFrontmatter({ rlFactory });

  // Step 2: Validate with Zod
  const frontmatter = validateFrontmatter({ ...rawFrontmatter, name });

  // Step 3: Generate body via Claude API
  console.log('\nGenerating role body...');
  const body = await generateRoleBody({ frontmatter });

  // Step 4: Write file
  const rolesDir = opts.rolesDir ?? getProjectRolesDir();
  const filePath = writeRole({ frontmatter, body, rolesDir });
  console.log(`\nRole created: ${filePath}`);
}

export const rolesCommand = new Command('roles')
  .description('Manage and inspect roles')
  .option('--roles-dir <path>', 'Custom roles directory');

rolesCommand
  .command('list')
  .description('List all available roles')
  .action(() => {
    const opts = rolesCommand.opts<RolesOptions>();

    if (opts.rolesDir) {
      const roles = loadAllRoles(opts.rolesDir);
      if (roles.length === 0) {
        console.log('No roles found. Run "devdemon roles create <name>" to create one.');
        return;
      }
      printRoleTable(roles);
      return;
    }

    const { builtin, project } = loadAllRolesGrouped();

    if (builtin.length === 0 && project.length === 0) {
      console.log('No roles found. Run "devdemon roles create <name>" to create one.');
      return;
    }

    if (builtin.length > 0) {
      console.log('Built-in Roles');
      console.log('==============');
      printRoleTable(builtin);
    }

    if (project.length > 0) {
      if (builtin.length > 0) console.log('');
      console.log('Project Roles (.devdemon/roles/)');
      console.log('================================');
      printRoleTable(project);
    }
  });

rolesCommand
  .command('show <name>')
  .description('Show detailed information about a role')
  .action((name: string) => {
    const opts = rolesCommand.opts<RolesOptions>();

    let roles: RoleConfig[];
    if (opts.rolesDir) {
      roles = loadAllRoles(opts.rolesDir);
    } else {
      const grouped = loadAllRolesGrouped();
      roles = [...grouped.builtin, ...grouped.project];
    }

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

rolesCommand
  .command('create <name>')
  .description('Create a new role with interactive prompts')
  .action(async (name: string) => {
    try {
      const opts = rolesCommand.opts();
      await createRoleAction(name, { rolesDir: opts.rolesDir });
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });
