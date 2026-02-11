import { createInterface } from 'readline';
import { readFileSync } from 'fs';
import { EventEmitter } from 'events';
import { render } from 'ink';
import React from 'react';
import { resolveRolesDir, loadAllRoles, loadAllRolesGrouped, loadRole, getBuiltinRolesDir } from '../../roles/loader.js';
import { join } from 'path';
import { ensureDevDemonDir, getStatePath, getQueuePath, getSettingsPath, getProjectRolesDir } from '../../utils/paths.js';
import { SettingsStore } from '../../settings/store.js';
import { App } from '../../ui/app.js';
import type { RoleConfig } from '../../roles/types.js';
import type { DevDemonStats } from '../../state/types.js';

export interface StartOptions {
  role?: string;
  repo?: string;
  rolesDir?: string;
  interval?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

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

export async function resolveRole(options: StartOptions): Promise<RoleConfig> {
  if (options.rolesDir) {
    const rolesDir = resolveRolesDir({ rolesDir: options.rolesDir });
    if (options.role) {
      const rolePath = join(rolesDir, `${options.role}.md`);
      try {
        return loadRole(rolePath);
      } catch {
        console.error(`Error: Role "${options.role}" not found in ${rolesDir}`);
        process.exit(1);
      }
    }
    const roles = loadAllRoles(rolesDir);
    return selectRole(roles);
  }

  const { builtin, project } = loadAllRolesGrouped();
  const allRoles = [...builtin, ...project];

  if (options.role) {
    const match = allRoles.find(
      r => r.filePath.endsWith(`/${options.role}.md`),
    );
    if (match) return match;
    console.error(`Error: Role "${options.role}" not found.`);
    process.exit(1);
  }

  return selectRole(allRoles);
}

async function selectRoleInk(roles: RoleConfig[]): Promise<RoleConfig> {
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

function loadPreviousStats(statePath: string): DevDemonStats | null {
  try {
    const data = readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed && parsed.version === 1 && parsed.stats) {
      return parsed.stats as DevDemonStats;
    }
    return null;
  } catch {
    return null;
  }
}

function createDryRunDaemon(role: RoleConfig, repoPath: string) {
  const daemon = new EventEmitter() as any;
  daemon.agent = new EventEmitter();
  daemon.role = role;
  daemon.repoPath = repoPath;
  daemon.queue = { length: 0 };
  daemon.state = {
    getStats: () => ({
      totalCycles: 0, totalCostUsd: 0, totalTasks: 0,
      userTasks: 0, autonomousTasks: 0, failedTasks: 0,
    }),
    save: () => {},
  };
  daemon.enqueueUserTask = (instruction: string) => {
    daemon.queue.length++;
  };
  daemon.stop = async () => {};
  return daemon;
}

export async function startAction(options: StartOptions): Promise<void> {
  const repoPath = options.repo ?? process.cwd();
  const settingsStore = new SettingsStore(getSettingsPath(repoPath));

  let role: RoleConfig;
  let allRoles: RoleConfig[];

  if (options.rolesDir) {
    const rolesDir = resolveRolesDir({ rolesDir: options.rolesDir });
    if (options.role) {
      const rolePath = join(rolesDir, `${options.role}.md`);
      try {
        role = loadRole(rolePath);
      } catch {
        console.error(`Error: Role "${options.role}" not found in ${rolesDir}`);
        process.exit(1);
      }
    } else {
      const roles = loadAllRoles(rolesDir);
      if (roles.length === 0) {
        console.error('No roles found.');
        process.exit(1);
      }
      if (roles.length === 1) {
        role = roles[0]!;
      } else {
        role = await selectRoleInk(roles);
      }
    }
    allRoles = loadAllRoles(rolesDir);
  } else {
    const grouped = loadAllRolesGrouped();
    allRoles = [...grouped.builtin, ...grouped.project];

    if (options.role) {
      const match = allRoles.find(
        r => r.filePath.endsWith(`/${options.role}.md`),
      );
      if (match) {
        role = match;
      } else {
        console.error(`Error: Role "${options.role}" not found.`);
        process.exit(1);
      }
    } else {
      if (allRoles.length === 0) {
        console.error('No roles found.');
        process.exit(1);
      }
      if (allRoles.length === 1) {
        role = allRoles[0]!;
      } else {
        role = await selectRoleInk(allRoles);
      }
    }
  }

  if (options.interval) {
    role.frontmatter.interval = Number(options.interval);
  }

  if (options.verbose) {
    console.log(`Role file: ${role.filePath}`);
    console.log(`Interval: ${role.frontmatter.interval}s`);
    console.log(`Max turns: ${role.frontmatter.maxTurns}`);
    console.log(`Permission mode: ${role.frontmatter.permissionMode}`);
    const settings = settingsStore.get();
    if (settings.model) console.log(`Model: ${settings.model}`);
    if (settings.language) console.log(`Language: ${settings.language}`);
  }

  if (options.dryRun) {
    const daemon = createDryRunDaemon(role, repoPath);
    const ink = render(React.createElement(App, {
      daemon,
      onQuit: () => { ink.unmount(); ink.cleanup(); process.exit(0); },
      showWelcome: true,
      selectedRole: role,
      allRoles: allRoles,
      repoPath: repoPath,
      previousStats: null,
      version: '0.1.0',
    }), {
      kittyKeyboard: { mode: 'auto' },
    });

    process.on('SIGINT', () => { ink.unmount(); ink.cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { ink.unmount(); ink.cleanup(); process.exit(0); });
    await new Promise(() => {}); // Keep process alive
    return;
  }

  const devdemonDir = ensureDevDemonDir(repoPath);
  const statePath = getStatePath(repoPath);
  const queuePath = getQueuePath(repoPath);

  // Load previous session stats
  const previousStats = loadPreviousStats(statePath);

  const { StateStore } = await import('../../state/store.js');
  const { TaskQueue } = await import('../../queue/task-queue.js');
  const { ProgressTracker } = await import('../../agent/progress-tracker.js');
  const { Agent } = await import('../../agent/agent.js');
  const { PromptBuilder } = await import('../../agent/prompt-builder.js');
  const { Daemon } = await import('../../daemon/daemon.js');

  const state = new StateStore(statePath, repoPath);
  const queue = new TaskQueue(queuePath);
  const progressTracker = new ProgressTracker(devdemonDir);
  const agent = new Agent(repoPath, settingsStore.get());
  const promptBuilder = new PromptBuilder(role, state, progressTracker);

  const daemon = new Daemon({
    role,
    repoPath,
    agent,
    queue,
    state,
    promptBuilder,
  });

  let ink: ReturnType<typeof render> | null = null;

  const shutdown = async () => {
    await daemon.stop();
    ink?.unmount();
  };

  // Render with welcome screen permanently visible + daemon
  ink = render(React.createElement(App, {
    daemon,
    onQuit: shutdown,
    showWelcome: true,
    selectedRole: role,
    allRoles: allRoles,
    repoPath: repoPath,
    previousStats: previousStats,
    version: '0.1.0',
  }), {
    kittyKeyboard: { mode: 'auto' },
  });

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await daemon.start();
}
