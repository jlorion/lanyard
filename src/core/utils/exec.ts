import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface RunOptions {
  input?: string;
  timeout?: number;
  env?: Record<string, string>;
  cwd?: string;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Run a command without a shell and collect its output.
 * Never rejects for a non-zero exit code; rejects only when the binary is missing.
 */
export function run(cmd: string, args: string[] = [], options: RunOptions = {}): Promise<RunResult> {
  const { input, timeout = 30000, env, cwd } = options;
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        windowsHide: true,
        stdio: 'pipe',
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);
    // Decode as UTF-8 streams so multi-byte characters split across chunks survive.
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      stdout += d;
    });
    child.stderr.on('data', (d: string) => {
      stderr += d;
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') err.message = `Command not found: ${cmd}. Is OpenSSH installed and on PATH?`;
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: timedOut ? -1 : (code ?? -1), stdout, stderr, timedOut });
    });
    if (input != null) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** Error with a machine-readable code the UI/CLI can branch on. */
export class LanyardError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'LanyardError';
  }
}
