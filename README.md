# Lanyard

Your SSH identities on a lanyard: a desktop app (Electron + React + TypeScript) and a CLI (`lanyard`, short alias `lny`) for managing SSH:

- **Git accounts per provider.** Keep several accounts on GitHub, GitLab, Bitbucket, Hugging Face, Azure DevOps, Codeberg, Gitea, SourceHut or a self-hosted server, and switch which one plain `git@github.com:…` URLs use.
- **Hosts.** Edit the `Host` entries in `~/.ssh/config` without losing comments or formatting. There's a raw editor that OpenSSH validates, an effective-config view (`ssh -G`), one-click connect, and **per-host key switching**.
- **Keys.** Generate keys, copy public keys, change passphrases, fix file permissions, and see which accounts and hosts use each key.
- **ssh-agent, known_hosts and backups.** Load and unload agent keys, scan and trust host keys, and restore any earlier version of your config.
- **System tray.** The app keeps running after you close its window. From the tray you can switch accounts, switch a host's key, connect, and run tests.

## Using the app

- **Overview**: who you are on each git host right now, switchable inline, plus your most-used hosts.
- **Command palette**: press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> to switch accounts, connect to a host, change a host's key, or jump anywhere.
- **Shortcuts**: <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>1</kbd>–<kbd>8</kbd> open the pages in sidebar order.
- **Appearance**: system, light or dark theme (bottom of the sidebar), and eight accent colours (Settings → Appearance, or type `accent` in the palette). The UI is set in Lato (Slack's UI typeface, bundled locally) with a Monaco / Menlo / Consolas monospace stack.

## How account switching works

The app owns one clearly marked block at the top of `~/.ssh/config`. Everything else in the file is left byte-for-byte untouched:

```sshconfig
# >>> lanyard managed section >>>
# GitHub - active account: work
Host github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github_work
    IdentitiesOnly yes

# GitHub - account: work
Host github.com-work
    HostName github.com
    ...
# GitHub - account: personal
Host github.com-personal
    HostName github.com
    ...
Host *
# <<< lanyard managed section <<<

# ...your own config, unchanged...
```

- **Switching** rewrites the `Host github.com` block, so plain `git@github.com:org/repo.git` URLs use the selected account.
- **Alias hosts** such as `github.com-personal` let you use several accounts side by side. `lanyard url` and `lanyard repo` rewrite remotes to use them.
- **The trailing `Host *`** resets scope, so global directives in your own part of the file still apply to every host.
- **Backups.** Every write is backed up to `~/.lanyard/backups` and can be restored from the app or the CLI.

## Development

```bash
npm install
npm run dev        # electron-vite dev server + Electron with hot reload
npm test           # vitest, runs against a throwaway ~/.ssh
npm run typecheck
npm run build      # compiles main, preload, renderer and the CLI into out/
npm run dist       # installer in release/ (NSIS on Windows, dmg on macOS, AppImage on Linux)
npm publish        # CLI-only npm package `lanyard-ssh` (prepack builds it first)
```

Set `LANYARD_SSH_DIR` and `LANYARD_HOME` to point the app and the CLI at a sandbox instead of `~/.ssh` and `~/.lanyard`.

## CLI

The command is `lanyard` (short alias `lny`). Running it with no arguments opens the desktop app; `lanyard --help` lists every command. Pick whichever way of getting it suits you:

| How | Needs | Command name |
|---|---|---|
| **Install the desktop app** - the Windows installer adds them to your PATH (macOS / Linux: run the `--install-cli` command shown in Settings once) | nothing (uses the app's own runtime) | `lanyard`, `lny` |
| **`npx lanyard-ssh <command>`**, e.g. `npx lanyard-ssh status` | Node.js 20+, nothing installed | `lanyard-ssh` |
| **`npm install -g lanyard-ssh`** | Node.js 20+ | `lanyard`, `lny` |
| **From source**: `npm run build`, then `npm link` | this repo | `lanyard`, `lny` |

The installer runs `Lanyard.exe --install-cli`, which writes small launcher scripts to `%LOCALAPPDATA%\Lanyard\bin` and adds that folder to your *user* PATH; the uninstaller runs `--uninstall-cli` to undo it. On macOS / Linux the same command installs into `~/.local/bin`. It only ever touches files it created. The npm package contains just the CLI (about 36 kB); `lanyard` with no arguments explains how to get the desktop app.

```bash
lanyard status                                   # active account per provider
lanyard accounts add github work --generate --git-name "Jane Doe" --git-email jane@work.com --set-git-identity
lanyard accounts add github personal --key ~/.ssh/id_ed25519 --git-name "Jane Doe" --git-email jane@personal.dev
lanyard use github personal                      # switch
lanyard test --all                               # ssh -T every account
git clone $(lanyard url github work https://github.com/acme/app)
lanyard repo github work ./my-repo               # point an existing repo at an account

lanyard hosts add prod -H 203.0.113.10 -u deploy -k id_ed25519_servers
lanyard hosts key prod id_ed25519_other          # switch the key a host uses
lanyard hosts key prod --default                 # back to ssh's default keys
lanyard connect prod
lanyard hosts resolve prod                       # ssh -G

lanyard keys gen id_ed25519_new -C me@example.com
lanyard agent add id_ed25519_new                 # prompts for the passphrase
lanyard known-hosts scan github.com --trust
lanyard backups list && lanyard backups restore <id>
lanyard gui                                      # open the desktop app
```

Add `--json` to any command for machine-readable output.

> Upgrading from the pre-rename `sshm` builds: `~/.sshm` is moved to `~/.lanyard` on first run, and the old `sshm managed section` block in `~/.ssh/config` is recognised and rewritten in place on the next change.

## Architecture

```
src/
├─ shared/        Types and the typed IPC contract (no runtime dependencies)
│  ├─ types.ts      Domain types used by every layer
│  └─ ipc.ts        SshmApi interface, channels, preload bridge type
├─ core/          Pure Node domain layer, shared by the app and the CLI
│  ├─ ssh-config/   Lossless parser, structured editor, managed section, repository
│  ├─ providers/    Provider registry and `ssh -T` result interpretation
│  ├─ services/     accounts (switching), hosts (CRUD + key switching), settings
│  ├─ keys/ known-hosts/ agent/ git/ backups/ terminal/ state/ config/ utils/
│  └─ index.ts      Facade: the only entry point the app and CLI use
├─ cli/           Commander program, one module per command group
├─ main/          Electron main process: window, tray, file watcher, IPC
│  └─ ipc/          SshmApi implementation + dispatcher
├─ preload/       contextBridge: one generic invoke + change events
└─ renderer/      React UI
   └─ src/
      ├─ app/         Shell, routes, sidebar
      ├─ components/  ui/ primitives, feedback/ (toasts, confirm), domain/
      ├─ features/    accounts, hosts, keys, agent, known-hosts, backups, settings
      ├─ hooks/       useResource (reloads on file changes), useTask
      ├─ lib/         Typed API client, formatting
      └─ styles/      Design tokens and component styles
```

The renderer is sandboxed and only talks to the main process through the typed `SshmApi`. The main process delegates every SSH operation to `src/core`, the same code the CLI runs. A file watcher on `~/.ssh` and `~/.lanyard` keeps the window and the tray in sync when the CLI or an editor changes something.
