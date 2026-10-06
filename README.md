# SSH Manager

A desktop app (Electron + React + TypeScript) and a CLI (`sshm`) for managing SSH:

- **Git accounts per provider.** Keep several accounts on GitHub, GitLab, Bitbucket, Hugging Face, Azure DevOps, Codeberg, Gitea, SourceHut or a self-hosted server, and switch which one plain `git@github.com:…` URLs use.
- **Hosts.** Edit the `Host` entries in `~/.ssh/config` without losing comments or formatting. There's a raw editor that OpenSSH validates, an effective-config view (`ssh -G`), one-click connect, and **per-host key switching**.
- **Keys.** Generate keys, copy public keys, change passphrases, fix file permissions, and see which accounts and hosts use each key.
- **ssh-agent, known_hosts and backups.** Load and unload agent keys, scan and trust host keys, and restore any earlier version of your config.
- **System tray.** The app keeps running after you close its window. From the tray you can switch accounts, switch a host's key, connect, and run tests.

## How account switching works

The app owns one clearly marked block at the top of `~/.ssh/config`. Everything else in the file is left byte-for-byte untouched:

```sshconfig
# >>> sshm managed section >>>
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
# <<< sshm managed section <<<

# ...your own config, unchanged...
```

- **Switching** rewrites the `Host github.com` block, so plain `git@github.com:org/repo.git` URLs use the selected account.
- **Alias hosts** such as `github.com-personal` let you use several accounts side by side. `sshm url` and `sshm repo` rewrite remotes to use them.
- **The trailing `Host *`** resets scope, so global directives in your own part of the file still apply to every host.
- **Backups.** Every write is backed up to `~/.sshm/backups` and can be restored from the app or the CLI.

## Development

```bash
npm install
npm run dev        # electron-vite dev server + Electron with hot reload
npm test           # vitest, runs against a throwaway ~/.ssh
npm run typecheck
npm run build      # compiles main, preload, renderer and the CLI into out/
npm run dist       # installer in release/ (NSIS on Windows, dmg on macOS, AppImage on Linux)
```

Set `SSHM_SSH_DIR` and `SSHM_HOME` to point the app and the CLI at a sandbox instead of `~/.ssh` and `~/.sshm`.

## CLI

After `npm run build`, run `npm link` once to put `sshm` on your PATH. An installed app also ships a shim at `resources/cli/sshm.cmd` (Windows) or `resources/cli/sshm` (macOS/Linux). It runs the CLI with the app's own binary, so it doesn't need Node.js.

```bash
sshm status                                   # active account per provider
sshm accounts add github work --generate --git-email me@work.com --set-git-identity
sshm accounts add github personal --key ~/.ssh/id_ed25519
sshm use github personal                      # switch
sshm test --all                               # ssh -T every account
git clone $(sshm url github work https://github.com/acme/app)
sshm repo github work ./my-repo               # point an existing repo at an account

sshm hosts add prod -H 203.0.113.10 -u deploy -k id_ed25519_servers
sshm hosts key prod id_ed25519_other          # switch the key a host uses
sshm hosts key prod --default                 # back to ssh's default keys
sshm connect prod
sshm hosts resolve prod                       # ssh -G

sshm keys gen id_ed25519_new -C me@example.com
sshm agent add id_ed25519_new                 # prompts for the passphrase
sshm known-hosts scan github.com --trust
sshm backups list && sshm backups restore <id>
sshm gui                                      # open the desktop app
```

Add `--json` to any command for machine-readable output.

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

The renderer is sandboxed and only talks to the main process through the typed `SshmApi`. The main process delegates every SSH operation to `src/core`, the same code the CLI runs. A file watcher on `~/.ssh` and `~/.sshm` keeps the window and the tray in sync when the CLI or an editor changes something.
