# Changelog

All notable changes to Lanyard are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A user guide with screenshots, published as the [GitHub wiki](https://github.com/riomar0001/lanyard/wiki) from `docs/wiki`.
- A new README, CONTRIBUTING.md, docs/ARCHITECTURE.md, and issue and pull request templates.

### Changed

- New app description, shown in Settings → About and in `lanyard --help`.

## [1.0.0-beta.2] - 2026-10-07

The first public build.

### Git accounts

- Several accounts per provider on GitHub, GitLab, Bitbucket, Hugging Face, Azure DevOps, Codeberg, Gitea and SourceHut, plus custom and self-hosted providers.
- One-click switching of the account plain `git@host:` URLs use, with an alias host per account for using several side by side.
- Generate a key for a new account or use an existing one; register it with a link straight to the provider's key settings; test it with `ssh -T`.
- A required git name and email per account, optionally applied to the global git config when the account becomes active.
- Point a repository at an account (remote URL and local identity), or rewrite a clone URL with `lanyard url`.

### Remote SSH management

- Every `Host` in `~/.ssh/config` in one searchable list, with a form editor (including ProxyJump and any other option) and a raw editor validated by OpenSSH. Comments and formatting are kept.
- Switch the key each server uses, connect in a terminal, test a login, and view the effective config (`ssh -G`).
- Scan, compare and trust host keys; forget a host after it is reinstalled.

### Keys, agent and backups

- Generate Ed25519, RSA and ECDSA keys; show and copy public keys; set, change or remove passphrases; restrict file permissions; delete to a trash folder. See which accounts and servers use each key.
- Load and unload keys in ssh-agent.
- A backup before every change to `~/.ssh/config` or `known_hosts`, with one-click restore.

### App

- Lives in the system tray, with account switching, per-server key switching, connect and test in the tray menu.
- Command palette (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>), keyboard shortcuts, back and forward history, and a Slack-style title bar.
- Light and dark themes and eight accent colours.
- `lanyard` / `lny` CLI covering everything in the app, with `--json` output. The Windows installer adds it to the PATH; it is also on npm as `lanyard-ssh`.

### Security

- Sandboxed renderer with a strict content security policy, IPC limited to the app's own page, and hardened Electron fuses.
- Passphrases are kept off the command line on Linux and macOS.
- See [SECURITY.md](SECURITY.md) for the full audit.

[Unreleased]: https://github.com/riomar0001/lanyard/compare/v1.0.0-beta.2...HEAD
[1.0.0-beta.2]: https://github.com/riomar0001/lanyard/releases/tag/v1.0.0-beta.2
