import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { join } from 'path';

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function spawnDevDemon(args: string[], options?: {
  cwd?: string;
  timeout?: number;
  stdin?: string;
}): Promise<SpawnResult> {
  const outFile = join(tmpdir(), `devdemon-test-${nanoid()}.stdout`);
  const errFile = join(tmpdir(), `devdemon-test-${nanoid()}.stderr`);

  const proc = Bun.spawn(['bun', 'run', join(import.meta.dir, '../../bin/devdemon.ts'), ...args], {
    cwd: options?.cwd ?? process.cwd(),
    stdout: Bun.file(outFile),
    stderr: Bun.file(errFile),
    stdin: options?.stdin ? new Response(options.stdin).body : undefined,
    env: { ...process.env, NO_COLOR: '1' },
  });

  const timeout = options?.timeout ?? 10000;
  const timer = setTimeout(() => proc.kill(), timeout);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  return {
    exitCode,
    stdout: await Bun.file(outFile).text().catch(() => ''),
    stderr: await Bun.file(errFile).text().catch(() => ''),
  };
}
