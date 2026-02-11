import { join } from 'path';

function stripAnsi(str: string): string {
  // Strip ANSI escape codes (CSI, OSC, simple escapes, kitty protocol sequences)
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~u]|\u001b\].*?(?:\u0007|\u001b\\)|\u001b[=>]/g,
    ''
  );
}

export interface PtyProcess {
  write(data: string): void;
  waitForOutput(pattern: RegExp, timeout?: number): Promise<string>;
  waitForText(text: string, timeout?: number): Promise<string>;
  getRawOutput(): string;
  getStrippedOutput(): string;
  kill(): void;
  waitForExit(timeout?: number): Promise<number>;
}

export interface PtySpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export function spawnDevDemonPty(
  args: string[],
  options?: PtySpawnOptions,
): PtyProcess {
  const binPath = join(import.meta.dir, '../../bin/devdemon.ts');

  let rawOutput = '';
  let strippedOutput = '';
  const waiters: Array<{
    pattern: RegExp;
    resolve: (output: string) => void;
    reject: (error: Error) => void;
  }> = [];

  function onData(_terminal: unknown, data: Buffer | Uint8Array) {
    const chunk = typeof data === 'string' ? data : new TextDecoder().decode(data);
    rawOutput += chunk;
    strippedOutput = stripAnsi(rawOutput);

    // Check all pending waiters
    for (let i = waiters.length - 1; i >= 0; i--) {
      const waiter = waiters[i]!;
      if (waiter.pattern.test(strippedOutput)) {
        waiters.splice(i, 1);
        waiter.resolve(strippedOutput);
      }
    }
  }

  const proc = Bun.spawn(['bun', 'run', binPath, ...args], {
    cwd: options?.cwd ?? process.cwd(),
    terminal: {
      cols: 120,
      rows: 40,
      data: onData,
    },
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
      ...options?.env,
    },
  });

  return {
    write(data: string) {
      proc.terminal!.write(data);
    },

    waitForOutput(pattern: RegExp, timeout = 15000): Promise<string> {
      if (pattern.test(strippedOutput)) {
        return Promise.resolve(strippedOutput);
      }
      return new Promise((resolve, reject) => {
        const waiter = { pattern, resolve, reject };
        waiters.push(waiter);

        const timer = setTimeout(() => {
          const idx = waiters.indexOf(waiter);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error(
            `Timeout waiting for pattern ${pattern} after ${timeout}ms.\n` +
            `Output (stripped):\n${strippedOutput}`
          ));
        }, timeout);

        const origResolve = waiter.resolve;
        waiter.resolve = (output) => {
          clearTimeout(timer);
          origResolve(output);
        };
      });
    },

    waitForText(text: string, timeout = 15000): Promise<string> {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return this.waitForOutput(new RegExp(escaped, 'i'), timeout);
    },

    getRawOutput(): string {
      return rawOutput;
    },

    getStrippedOutput(): string {
      return strippedOutput;
    },

    kill() {
      proc.kill();
      if (proc.terminal && !proc.terminal.closed) {
        proc.terminal.close();
      }
    },

    async waitForExit(timeout = 15000): Promise<number> {
      const timer = setTimeout(() => proc.kill(), timeout);
      const code = await proc.exited;
      clearTimeout(timer);
      return code;
    },
  };
}
