import { Command } from 'commander';
import { resolveRolesDir, loadAllRoles, loadRole } from '../../roles/loader.js';
import { join } from 'path';

interface StartOptions {
  role?: string;
  repo?: string;
  rolesDir?: string;
  interval?: string;
  verbose?: boolean;
}

export const startCommand = new Command('start')
  .description('Start the DevDemon agent daemon')
  .option('-r, --role <name>', 'Role name to use')
  .option('--repo <path>', 'Repository path to work on')
  .option('--roles-dir <path>', 'Custom roles directory')
  .option('-i, --interval <seconds>', 'Override interval in seconds')
  .option('-v, --verbose', 'Enable verbose output')
  .action((options: StartOptions) => {
    const rolesDir = resolveRolesDir({ rolesDir: options.rolesDir });

    if (options.role) {
      const rolePath = join(rolesDir, `${options.role}.md`);
      try {
        const role = loadRole(rolePath);
        const interval = options.interval
          ? Number(options.interval)
          : role.frontmatter.interval;
        if (options.verbose) {
          console.log(`Roles directory: ${rolesDir}`);
          console.log(`Role file: ${rolePath}`);
          console.log(`Interval: ${interval}s`);
          console.log(`Max turns: ${role.frontmatter.maxTurns}`);
          console.log(`Permission mode: ${role.frontmatter.permissionMode}`);
        }
        console.log(`Starting DevDemon with role: ${role.frontmatter.name}...`);
      } catch {
        console.error(`Error: Role "${options.role}" not found in ${rolesDir}`);
        process.exit(1);
      }
      return;
    }

    // No role specified — list available and pick first
    const roles = loadAllRoles(rolesDir);
    if (roles.length === 0) {
      console.error('Error: No roles found. Run "devdemon init" or specify --roles-dir.');
      process.exit(1);
    }

    console.log('Available roles:');
    for (const r of roles) {
      console.log(`  - ${r.frontmatter.name}`);
    }
    const selected = roles[0];
    console.log(`\nAuto-selecting first role: ${selected.frontmatter.name}`);
    console.log(`Starting DevDemon with role: ${selected.frontmatter.name}...`);
  });
