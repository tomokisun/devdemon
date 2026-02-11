import { describe, test } from 'bun:test';

describe('devdemon user input interrupt (E2E)', () => {
  test.skip('stdin input is enqueued as user task', () => {
    // Skip: Testing stdin → queue flow E2E requires the daemon to be
    // running with a valid Claude API connection. The Ink UI reads stdin
    // and calls daemon.enqueueUserTask(), but without the full daemon
    // running, stdin piping cannot be meaningfully tested.
    // The stdin handling is covered by UI component tests in test/ui/
    // and unit tests for TaskQueue.
  });

  test.skip('SIGINT triggers graceful shutdown', () => {
    // Skip: Graceful shutdown via SIGINT requires the daemon process to
    // be in a running state (post-API-initialization). Sending SIGINT to
    // a process that hasn't fully started may produce inconsistent results.
    // The shutdown flow is tested in unit tests for Daemon.stop().
  });
});
