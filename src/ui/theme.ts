import type { LogEntryKind } from '../agent/message-stream.js';

// ---------------------------------------------------------------------------
// Theme color constants
// ---------------------------------------------------------------------------

/**
 * Semantic color tokens used across the DevDemon UI.
 *
 * Every hardcoded color string in the component tree is mapped to one of
 * these tokens so that they can be overridden in one place.
 */
export interface ThemeColors {
  /** Primary accent – role names, interactive prompts, links */
  primary: string;
  /** Secondary accent – titles, thinking indicators, borders */
  secondary: string;
  /** Positive outcomes – success marks, repo names, cost */
  success: string;
  /** Warning / in-progress – queue counts, running tasks, status */
  warning: string;
  /** Negative outcomes – error marks */
  error: string;
  /** Muted descriptive text (e.g. role-selector descriptions) */
  muted: string;
  /** Informational – uptime, spinners */
  info: string;
}

export const colors: ThemeColors = {
  primary:   'cyan',
  secondary: 'magenta',
  success:   'green',
  warning:   'yellow',
  error:     'red',
  muted:     'gray',
  info:      'cyan',
};

// ---------------------------------------------------------------------------
// StyleDef for log entries
// ---------------------------------------------------------------------------

export interface StyleDef {
  prefix: string;
  color: string | undefined;
  dim: boolean;
  bold: boolean;
  bgColor?: string;
}

// ---------------------------------------------------------------------------
// STYLE_MAP – visual style for every LogEntryKind
// ---------------------------------------------------------------------------

export const STYLE_MAP: Record<LogEntryKind, StyleDef> = {
  assistant_text:      { prefix: '⏺ ',  color: 'green',          dim: false, bold: false },
  tool_use:            { prefix: '⏺ ',  color: colors.primary,   dim: false, bold: true  },
  tool_result:         { prefix: '  ⎿ ', color: undefined,        dim: true,  bold: false },
  tool_progress:       { prefix: '⏳ ',  color: colors.warning,   dim: false, bold: false },
  tool_use_summary:    { prefix: '📋 ',  color: colors.primary,   dim: true,  bold: false },
  tool_group:          { prefix: '⏺ ',  color: colors.primary,   dim: false, bold: true  },
  tool_batch:          { prefix: '⏺ ',  color: colors.primary,   dim: false, bold: true  },
  thinking_time:       { prefix: '* ',   color: colors.secondary, dim: false, bold: false },
  task_agents_summary: { prefix: '⏺ ',  color: colors.primary,   dim: false, bold: false },
  system_init:         { prefix: '⚡ ',  color: colors.success,   dim: false, bold: false },
  system_status:       { prefix: '● ',   color: colors.warning,   dim: false, bold: false },
  system_hook:         { prefix: '🪝 ',  color: colors.warning,   dim: true,  bold: false },
  result_success:      { prefix: '✓ ',   color: colors.success,   dim: false, bold: true  },
  result_error:        { prefix: '✗ ',   color: colors.error,     dim: false, bold: true  },
  compact_boundary:    { prefix: '─ ',   color: colors.secondary, dim: false, bold: false },
  stream_text:         { prefix: '',     color: undefined,        dim: true,  bold: false },
  cycle_separator:     { prefix: '',     color: undefined,        dim: true,  bold: false },
  user_task:           { prefix: '❯ ',   color: colors.primary,   dim: false, bold: true, bgColor: '#3d3000' },
};

// ---------------------------------------------------------------------------
// Task status colors (task-log)
// ---------------------------------------------------------------------------

export interface TaskStatusStyle {
  mark: string;
  color: string;
}

export const taskStatusStyles: Record<'completed' | 'failed' | 'running', TaskStatusStyle> = {
  completed: { mark: '✓', color: colors.success },
  failed:    { mark: '✗', color: colors.error },
  running:   { mark: '⟳', color: colors.warning },
};

// ---------------------------------------------------------------------------
// Diff display styles
// ---------------------------------------------------------------------------

export interface DiffStyle {
  added: { bg: string; fg: string };
  removed: { bg: string; fg: string };
  lineNumber: { color: string };
  context: { dim: boolean };
  summary: { color: string };
}

export const diffStyles: DiffStyle = {
  added:      { bg: '#1a3d1a', fg: '#4ade80' },
  removed:    { bg: '#3d1a1a', fg: '#f87171' },
  lineNumber: { color: '#a8a29e' },
  context:    { dim: true },
  summary:    { color: colors.muted },
};

// Re-export MAX_LINE_LENGTH so consumers can import from theme if desired.
export { MAX_LINE_LENGTH } from '../constants.js';
