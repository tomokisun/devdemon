// ---------------------------------------------------------------------------
// Centralized constants for the devdemon project.
// Grouped by domain to keep related values together.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Name of the project-level configuration directory. */
export const DEVDEMON_DIR_NAME = '.devdemon';

// ---------------------------------------------------------------------------
// Daemon / State limits
// ---------------------------------------------------------------------------

/** Maximum number of log entries retained per task cycle in the UI. */
export const MAX_LOG_ENTRIES = 200;

// ---------------------------------------------------------------------------
// UI display limits
// ---------------------------------------------------------------------------

/** Maximum characters shown on a single log line before truncation. */
export const MAX_LINE_LENGTH = 120;

/** Maximum number of tool-result lines displayed before collapsing. */
export const MAX_VISIBLE_LINES = 5;

/** Maximum character length for a task prompt shown in the task log. */
export const MAX_TASK_PROMPT_LENGTH = 60;

/** Maximum character length for a repository path in the welcome screen. */
export const MAX_PATH_DISPLAY_LENGTH = 40;

/** Width proportion for the left/right columns on the welcome screen. */
export const WELCOME_COLUMN_WIDTH = '50%';

// ---------------------------------------------------------------------------
// Text / content truncation
// ---------------------------------------------------------------------------

/** Maximum characters kept from a tool result before truncation. */
export const MAX_TOOL_RESULT_LENGTH = 500;

/** Maximum characters kept from a prompt entry in the recent history. */
export const MAX_HISTORY_PROMPT_LENGTH = 100;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/** Number of recent history items included in the autonomous prompt. */
export const RECENT_HISTORY_COUNT = 5;

// ---------------------------------------------------------------------------
// Throttling
// ---------------------------------------------------------------------------

/** Minimum interval (ms) between flushing the streaming text buffer. */
export const STREAM_THROTTLE_MS = 100;
