import { useState, useEffect, useRef } from 'react';
import { execSync } from 'child_process';

export interface GitFileStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

/** How often to poll git diff stats (in ms). */
const POLL_INTERVAL_MS = 5_000;

/**
 * Parse the summary line from `git diff --shortstat`.
 *
 * Example output:
 *   " 3 files changed, 42 insertions(+), 10 deletions(-)"
 *   " 1 file changed, 5 insertions(+)"
 *   " 2 files changed, 8 deletions(-)"
 */
export function parseGitShortstat(output: string): GitFileStats {
  const filesMatch = output.match(/(\d+)\s+files?\s+changed/);
  const insertMatch = output.match(/(\d+)\s+insertions?\(\+\)/);
  const deleteMatch = output.match(/(\d+)\s+deletions?\(-\)/);

  return {
    filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
    insertions: insertMatch ? parseInt(insertMatch[1], 10) : 0,
    deletions: deleteMatch ? parseInt(deleteMatch[1], 10) : 0,
  };
}

/**
 * React hook that polls `git diff --shortstat` to track working tree changes.
 * Returns null if the repo is not a git repository or git is unavailable.
 */
export function useGitStats(repoPath: string): GitFileStats | null {
  const [stats, setStats] = useState<GitFileStats | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function fetchStats() {
      try {
        const output = execSync('git diff --shortstat', {
          cwd: repoPath,
          encoding: 'utf-8',
          timeout: 3000,
        }).trim();

        if (output.length === 0) {
          setStats({ filesChanged: 0, insertions: 0, deletions: 0 });
          return;
        }

        setStats(parseGitShortstat(output));
      } catch {
        // Not a git repo, git not available, or command timed out
        setStats(null);
      }
    }

    // Fetch immediately, then poll
    fetchStats();
    intervalRef.current = setInterval(fetchStats, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [repoPath]);

  return stats;
}
