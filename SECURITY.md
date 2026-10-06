# Security

Lanyard edits `~/.ssh/config`, generates and moves private keys, edits
`known_hosts`, sets global git config and, on Windows, writes the user `PATH`.
A bug here can lock you out of servers or expose a key, so this file records
the threat model, the audit behind the current code, and what is left open.

## Reporting a vulnerability

Please report security problems privately via a
[GitHub security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, not as a public issue. Include steps to reproduce and the
Lanyard version (Settings → About, or `lanyard --version`).

## Threat model

- **Trusted:** the local user running Lanyard and the code bundled with the
  app. Lanyard deliberately gives that user full control of their own SSH
  setup: the raw config editor can write any directive, including
  `ProxyCommand`, and Settings can set git's `core.sshCommand`.
- **Not trusted:** anything that is not our bundled renderer page (remote web
  content, other local users, values that end up as arguments to `ssh`,
  `ssh-keygen`, `git`, `reg` or a terminal), and the environment of a packaged
  build.
- **Boundary:** the renderer is sandboxed (`contextIsolation`, `sandbox`, no
  Node integration) and reaches the main process through one IPC channel. The
  main process only answers the top frame of the bundled page, so the API is
  never available to anything else the window might load.

## Audit: 2026-10-07

Scope: Electron configuration and IPC, every place user input reaches a child
process, the filesystem or ssh_config, secrets handling, the Windows CLI
installer, and dependencies. Every finding below is fixed, and the fixes are
covered by `test/security.test.ts` or were verified against a packaged build.

| #   | Severity | Finding                                                                                                                                                                                                                                                             | Fix                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | High     | The packaged app honoured `ELECTRON_RENDERER_URL`: anyone able to set that variable could make Lanyard load a remote page, and the IPC check trusted the same variable, so the page would get the full API (generate keys, rewrite the SSH config, open terminals). | The dev-server URL is used only when the app is not packaged (`src/main/security.ts`). IPC now accepts only the top frame of the exact renderer page, instead of any `file://` URL.                                                                                                                                                                                                  |
| 2   | Medium   | Key passphrases were passed to `ssh-keygen` as `-N` / `-P` arguments. Process arguments are visible to other local users on Linux and macOS (`ps`, `/proc/*/cmdline`).                                                                                              | On Linux and macOS, passphrases are typed into ssh-keygen's prompts through stdin, with the process started without a controlling terminal so it reads them from there. Verified with OpenSSH 10.2. Windows OpenSSH reads prompts only from the console, never stdin, so there they stay in `-P` / `-N`: Windows lets only the process owner and administrators read a command line. |
| 3   | Medium   | The Windows CLI installer read the user `PATH` with `reg query /v Path` and treated any failure as "empty". A failed read would then have overwritten the user's whole `PATH` with Lanyard's folder.                                                                | The installer reads the whole `HKCU\Environment` key; any failure aborts the install instead of writing a guessed value.                                                                                                                                                                                                                                                             |
| 4   | Medium   | `keys.remove` and `keys.fixPermissions` accepted any absolute path, so a bad reference could move any file to Lanyard's trash or run `icacls` on it.                                                                                                                | Both now refuse anything that is not an SSH key (a private-key file, or a file with a valid `.pub` beside it).                                                                                                                                                                                                                                                                       |
| 5   | Low      | Host aliases and `known_hosts` hosts could start with `-`, so `ssh`, `ssh-keygen` and `ssh-keyscan` would read them as options (`-oProxyCommand=…`).                                                                                                                | The validators reject a leading `-`.                                                                                                                                                                                                                                                                                                                                                 |
| 6   | Low      | Host option values from the structured editor were not checked for newlines, so a value like `x\nProxyCommand …` was written as an extra directive the form never showed.                                                                                           | Option names must be single words and values single lines.                                                                                                                                                                                                                                                                                                                           |
| 7   | Low      | The "open in terminal" guard allowed typographic quotes (`’`), which PowerShell treats as quotes, and did not check the window title passed to Windows Terminal.                                                                                                    | Both are now covered by the metacharacter check.                                                                                                                                                                                                                                                                                                                                     |
| 8   | Low      | The production CSP still allowed the dev server's websocket and `'unsafe-inline'` styles, and set no `object-src` / `base-uri` / `form-action`.                                                                                                                     | Production builds ship `default-src 'self'` with no inline styles, no websocket, `object-src 'none'`, `base-uri 'none'` and `form-action 'none'`.                                                                                                                                                                                                                                    |
| 9   | Low      | No defence in depth beyond the main window: permission requests were not denied, and `<webview>` and navigation were not blocked for other web contents.                                                                                                            | All permission requests and checks are denied, `<webview>` is blocked, and every web contents can only navigate to the renderer page, with new windows denied.                                                                                                                                                                                                                       |
| 10  | Low      | Electron fuses were at their defaults.                                                                                                                                                                                                                              | Packaged builds disable `NODE_OPTIONS` and `--inspect`, enable asar integrity validation and asar-only loading, and keep cookie encryption on (`electron-builder.yml`).                                                                                                                                                                                                              |

### Checked and found sound

- Every child process is spawned without a shell, with an argument array.
- `openExternal` only opens `https:` links; window-open requests are denied.
- IPC dispatch only calls the API object's own methods (`Object.hasOwn`), so `__proto__` and friends are unreachable.
- Account, provider, key-file, backup and alias names are validated against strict patterns before they touch paths or config.
- New files under `~/.ssh` are created `0600` and Lanyard's data directory `0700`. Existing files are written in place so their permissions and Windows ACLs survive.
- Removed keys go to `~/.lanyard/trash`, never straight to deletion. Every config write is backed up first.
- No secrets are stored: passphrases are never written to disk or to `state.json`.
- The CLI shims and `PATH` entry are per-user, and only files carrying Lanyard's marker are ever overwritten or removed.

### Accepted risks

- **`RunAsNode` fuse stays enabled.** The installed `lanyard` command runs `Lanyard.exe` with `ELECTRON_RUN_AS_NODE`, so the binary can act as a Node runtime. This does not cross a privilege boundary (it runs as the invoking user), but it is a known "living off the land" binary pattern.
- **Trusted-user features.** The raw config editor, custom host options and git's `core.sshCommand` setting can all run commands by design (for example via `ProxyCommand`). They are the user's own configuration, and the protections above keep anyone else from driving them.
- **Build-time dependency advisory.** `npm audit` reports `sprintf-js` (GHSA-hp3w-g68c-fv3c, moderate, a denial of service through format strings). It is pulled in only by electron-builder's Electron download tooling, takes no attacker input, and has no patched release. Runtime dependencies: `npm audit --omit=dev` reports 0 vulnerabilities, and CI fails if that changes.
