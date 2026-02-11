import React, { useState, useEffect } from 'react';
import { execSync } from 'child_process';
import { Box } from 'ink';
import { Header } from './components/header.js';
import { TaskLog } from './components/task-log.js';
import { InteractionLog } from './components/interaction-log.js';
import { StatusBar } from './components/status-bar.js';
import { InputBar } from './components/input-bar.js';
import { RoleSelector } from './components/role-selector.js';
import { WelcomeScreen } from './components/welcome-screen.js';
import { useDaemon } from './hooks/use-daemon.js';
import { useInputQueue } from './hooks/use-input-queue.js';
import { useGitStats } from './hooks/use-git-stats.js';
import type { Daemon } from '../daemon/daemon.js';
import type { RoleConfig } from '../roles/types.js';
import type { DevDemonStats } from '../state/types.js';

interface AppProps {
  daemon?: Daemon;
  onQuit?: () => void;
  roles?: RoleConfig[];
  onRoleSelected?: (role: RoleConfig) => void;
  showWelcome?: boolean;
  selectedRole?: RoleConfig;
  allRoles?: RoleConfig[];
  repoPath?: string;
  previousStats?: DevDemonStats | null;
  version?: string;
}

export function App({ daemon, onQuit, roles, onRoleSelected, showWelcome, selectedRole, allRoles, repoPath, previousStats, version }: AppProps) {
  // If no daemon yet and roles are provided, show role selection
  if (!daemon && roles && onRoleSelected) {
    return <RoleSelector roles={roles} onSelect={onRoleSelected} />;
  }

  // Welcome screen phase (shown while daemon is initializing)
  if (showWelcome && selectedRole && allRoles && repoPath && !daemon) {
    return (
      <WelcomeScreen
        role={selectedRole}
        roles={allRoles}
        repoPath={repoPath}
        stats={previousStats ?? null}
        version={version ?? '0.1.0'}
      />
    );
  }

  if (!daemon || !onQuit) {
    return null;
  }

  // Daemon running WITH welcome screen permanently visible
  if (selectedRole && allRoles && repoPath) {
    return (
      <Box flexDirection="column">
        <WelcomeScreen
          role={selectedRole}
          roles={allRoles}
          repoPath={repoPath}
          stats={previousStats ?? null}
          version={version ?? '0.1.0'}
        />
        <DaemonContent daemon={daemon} onQuit={onQuit} />
      </Box>
    );
  }

  // Fallback: daemon view with header (backward compat)
  return <DaemonViewWithHeader daemon={daemon} onQuit={onQuit} />;
}

function DaemonContent({ daemon, onQuit }: { daemon: Daemon; onQuit: () => void }) {
  const { status, currentTask, taskLog, stats, initInfo } = useDaemon(daemon);
  const { input, setInput, submit } = useInputQueue(daemon, onQuit);
  const [startedAt] = useState(() => new Date().toISOString());
  const [gitBranch, setGitBranch] = useState<string | undefined>();
  const fileStats = useGitStats(daemon.repoPath);

  useEffect(() => {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: daemon.repoPath,
        encoding: 'utf-8',
      }).trim();
      setGitBranch(branch);
    } catch {
      // Not a git repo or git not available
    }
  }, [daemon.repoPath]);

  return (
    <>
      <TaskLog entries={taskLog} />
      <InteractionLog
        entries={currentTask?.entries ?? []}
        streamingText={currentTask?.streamingText ?? ''}
        isProcessing={status === 'running'}
        cycleStartedAt={currentTask?.cycleStartedAt}
        currentTokens={currentTask?.currentTokens ?? 0}
      />
      <InputBar value={input} onChange={setInput} onSubmit={submit} />
      <StatusBar
        queueLength={daemon.queue.length}
        totalCostUsd={stats.totalCostUsd}
        startedAt={startedAt}
        model={initInfo?.model}
        permissionMode={daemon.role.frontmatter.permissionMode}
        gitBranch={gitBranch}
        fileStats={fileStats}
      />
    </>
  );
}

function DaemonViewWithHeader({ daemon, onQuit }: { daemon: Daemon; onQuit: () => void }) {
  const { status, currentTask, taskLog, stats, initInfo } = useDaemon(daemon);
  const { input, setInput, submit } = useInputQueue(daemon, onQuit);
  const [startedAt] = useState(() => new Date().toISOString());
  const [gitBranch, setGitBranch] = useState<string | undefined>();
  const fileStats = useGitStats(daemon.repoPath);

  useEffect(() => {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: daemon.repoPath,
        encoding: 'utf-8',
      }).trim();
      setGitBranch(branch);
    } catch {
      // Not a git repo or git not available
    }
  }, [daemon.repoPath]);

  return (
    <Box flexDirection="column">
      <Header
        roleName={daemon.role.frontmatter.name}
        repoPath={daemon.repoPath}
        cycle={stats.totalCycles}
      />
      <TaskLog entries={taskLog} />
      <InteractionLog
        entries={currentTask?.entries ?? []}
        streamingText={currentTask?.streamingText ?? ''}
        isProcessing={status === 'running'}
        cycleStartedAt={currentTask?.cycleStartedAt}
        currentTokens={currentTask?.currentTokens ?? 0}
      />
      <InputBar value={input} onChange={setInput} onSubmit={submit} />
      <StatusBar
        queueLength={daemon.queue.length}
        totalCostUsd={stats.totalCostUsd}
        startedAt={startedAt}
        model={initInfo?.model}
        permissionMode={daemon.role.frontmatter.permissionMode}
        gitBranch={gitBranch}
        fileStats={fileStats}
      />
    </Box>
  );
}
