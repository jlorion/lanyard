# Architecture

Lanyard is one TypeScript codebase that builds two programs: the Electron desktop app (window and tray) and the `lanyard` CLI. Both run the same domain code against the same files.

```
src/
├─ shared/        Types and the typed IPC contract (no runtime dependencies)
│  ├─ types.ts      Domain types used by every layer
│  ├─ ipc.ts        LanyardApi interface, channels, preload bridge type
│  └─ validation.ts Small validators shared by the UI and the core
├─ core/          Pure Node domain layer, shared by the app and the CLI
│  ├─ ssh-config/   Lossless parser, structured editor, managed section, repository
│  ├─ providers/    Provider registry and `ssh -T` result interpretation
│  ├─ services/     accounts (switching), hosts (CRUD + key switching), settings
│  ├─ keys/ known-hosts/ agent/ git/ backups/ terminal/ state/ config/ cli/ utils/
│  └─ index.ts      Facade: the only entry point the app and the CLI use
├─ cli/           Commander program, one module per command group
├─ main/          Electron main process
│  ├─ index.ts      Startup, single-instance lock, --install-cli / --uninstall-cli
│  ├─ window.ts     The window (hides to the tray on close)
│  ├─ tray.ts       Tray menu (hosts submenu built by tray-hosts-menu.ts)
│  ├─ app-menu.ts   File / Edit / View / Go / History / Help
│  ├─ security.ts   Renderer URL, permission and navigation hardening
│  ├─ watcher.ts    Watches ~/.ssh and ~/.lanyard, notifies the renderer and tray
│  ├─ cli-install.ts Puts `lanyard` / `lny` on the user's PATH
│  └─ ipc/          LanyardApi implementation + dispatcher
├─ preload/       contextBridge: one generic invoke + change, navigate and command events
└─ renderer/      React UI
   └─ src/
      ├─ app/         Shell, top bar, sidebar, navigation, workspace data
      ├─ components/  ui/ primitives, feedback/ (toasts, confirm), domain/
      ├─ features/    overview, accounts, hosts, keys, agent, known-hosts, backups, settings, palette
      ├─ hooks/       useResource (reloads on file changes), useTask
      ├─ lib/         Typed API client, formatting
      └─ styles/      Design tokens and component styles
```

## Layers

- **`shared`** has no runtime dependencies and is imported by every other layer.
- **`core`** is plain Node.js: no Electron, no React. It shells out to OpenSSH (`ssh`, `ssh-keygen`, `ssh-add`, `ssh-keyscan`) and git, always without a shell and with argument arrays. Everything goes through `core/index.ts`.
- **`cli`** and **`main`** both depend on `core`, never on each other.
- **`renderer`** never touches Node or the filesystem. It calls the main process through the typed `LanyardApi` client in `lib/api.ts`.

## Data flow

1. A React component calls `api.accounts.use('github', 'work')`.
2. The preload bridge forwards it on the single `invoke` channel.
3. `main/ipc/register.ts` checks that the call comes from the app's own page, then dispatches to `main/ipc/api.ts`.
4. `api.ts` delegates to `core.accounts.use`, which rewrites the managed section of `~/.ssh/config` (after a backup) and saves `~/.lanyard/state.json`.
5. The file watcher sees the change and tells the renderer and the tray, which reload what they show.

The CLI calls the same `core` functions directly, so a change made from the terminal shows up in an open window through step 5.

## The ssh_config editor

`core/ssh-config` parses `~/.ssh/config` into a model that keeps every line's original text: comments, blank lines, indentation and line endings (LF or CRLF). Edits replace only the lines they touch, and serialising an unedited model gives back the file byte for byte. The managed section (between the `lanyard managed section` markers) is regenerated from state on every change; everything else is edited structurally.

## Security model

The renderer is sandboxed with context isolation and no Node integration, under a strict content security policy. Only the top frame of the bundled page may call the API, navigation and new windows are blocked, and packaged builds set Electron fuses. Details and the latest audit: [SECURITY.md](../SECURITY.md).

## Build

- **electron-vite** builds three bundles into `out/`: `main` (with the CLI as a second entry, `out/main/cli.js`), `preload` and `renderer`.
- **electron-builder** packages the app (`electron-builder.yml`): NSIS on Windows, dmg on macOS, AppImage on Linux.
- **The npm package `lanyard-ssh`** ships only `bin/` and `out/main/`, so the CLI runs on plain Node.js without Electron.
- **The packaged CLI** runs the app's own binary in Node mode (`ELECTRON_RUN_AS_NODE`) on `app.asar/bin/lanyard.js`, so it needs no separate Node.js install.
