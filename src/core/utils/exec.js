'use strict';

const { spawn } = require('child_process');

/**
 * Run a command without a shell and collect its output.
 * Never rejects for a non-zero exit code; rejects only when the binary is missing.
 */
function run(cmd, args = [], { input, timeout = 30000, env, cwd } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      reject(err);
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') err.message = `Command not found: ${cmd}. Is OpenSSH installed and on PATH?`;
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: timedOut ? -1 : code, stdout, stderr, timedOut });
    });
    if (input != null) child.stdin.end(input);
    else child.stdin.end();
  });
}

module.exports = { run };
