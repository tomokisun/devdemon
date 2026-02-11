import { render } from 'ink';
import React from 'react';
import { getSettingsPath } from '../../utils/paths.js';
import { SettingsStore } from '../../settings/store.js';
import { App } from '../../ui/app.js';
import { resolveRoleWithSelector, selectRoleInk } from './role-selection.js';
import { createDryRunDaemon, createDaemon } from './daemon-factory.js';
import { validateIntervalOverride, formatValidationError } from '../../roles/validator.js';
import { z } from 'zod';

// Re-export for backward compatibility (tests import from this module)
export { formatRoleMenu, selectRole, resolveRole } from './role-selection.js';

export interface StartOptions {
  role?: string;
  repo?: string;
  rolesDir?: string;
  interval?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

export async function startAction(options: StartOptions): Promise<void> {
  const repoPath = options.repo ?? process.cwd();
  const settingsStore = new SettingsStore(getSettingsPath(repoPath));

  const { role, allRoles } = await resolveRoleWithSelector(
    options,
    (roles) => selectRoleInk(roles),
  );

  if (options.interval) {
    try {
      role.frontmatter.interval = validateIntervalOverride(options.interval);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`Error: Invalid --interval value "${options.interval}": ${formatValidationError(error)}`);
      } else {
        console.error(`Error: Invalid --interval value "${options.interval}"`);
      }
      process.exit(1);
    }
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

  const { daemon, previousStats } = await createDaemon(role, repoPath, settingsStore);

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
