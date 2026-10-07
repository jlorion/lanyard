# Contributing to Lanyard

Thanks for helping. This page covers building from source, the checks a change has to pass, and how releases are made.

- **Bug or idea:** [open an issue](https://github.com/riomar0001/lanyard/issues/new/choose).
- **Security problem:** report it privately, as described in [SECURITY.md](SECURITY.md). Don't open a public issue.

## Set up

You need Node.js 24 (CI uses 24; the published CLI runs on 20+), git, and the OpenSSH client tools (`ssh -V` should work).

```bash
git clone https://github.com/riomar0001/lanyard.git
cd lanyard
npm ci
npm run dev
```

`npm run dev` starts the app with hot reload. To keep experiments away from your real `~/.ssh`, point the app and the CLI at a sandbox:

```bash
LANYARD_SSH_DIR=/tmp/lny/.ssh LANYARD_HOME=/tmp/lny/.lanyard npm run dev
```

On Windows PowerShell: `$env:LANYARD_SSH_DIR = "$env:TEMP\lny\.ssh"` (and `LANYARD_HOME` the same way), then `npm run dev`.

## Scripts

| Script                 | What it does                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`          | App with hot reload.                                                                  |
| `npm run build`        | Compile main, preload, renderer and the CLI into `out/`.                              |
| `npm run lanyard -- …` | Run the CLI from `out/` (build first), e.g. `npm run lanyard -- status`.              |
| `npm test`             | Vitest. Tests run against a throwaway `~/.ssh` and use the real `ssh` / `ssh-keygen`. |
| `npm run typecheck`    | TypeScript (tsgo) for the Node and the web projects.                                  |
| `npm run lint`         | ESLint with type-aware rules. `npm run lint:fix` applies the safe fixes.              |
| `npm run format`       | Prettier. `npm run format:check` only reports.                                        |
| `npm run check`        | Everything CI checks: format, lint, typecheck, tests.                                 |
| `npm run dist`         | Build an installer into `release/` for the current OS.                                |
| `npm run icons`        | Regenerate the app and tray icons in `resources/`.                                    |

## Making a change

1. Branch from `main`.
2. Make the change. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first if you're new to the code: domain logic belongs in `src/core` so the app and the CLI both get it.
3. Add or update tests in `test/` for anything in `src/core`.
4. Run `npm run check`.
5. If users will notice the change, add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md). If it changes how the app is used, update the matching page in [`docs/wiki`](docs/wiki).
6. Open a pull request. CI runs the same checks on Windows, macOS and Linux.

### Conventions

- **Formatting** is Prettier's job; don't hand-format.
- **Commits:** one logical change per commit, with an imperative subject line ("Add host search", not "Added…"), and a body explaining why when it isn't obvious.
- **Shelling out:** always use `run()` from `src/core/utils/exec.ts` with an argument array, never a shell string. Validate anything user-supplied that becomes an argument (see the validators in `src/core`).
- **Never touch the real `~/.ssh` in tests.** Set `LANYARD_SSH_DIR` and `LANYARD_HOME` before importing the core, as the existing tests do.

## Documentation

- The user guide lives in [`docs/wiki`](docs/wiki) and is published to the [GitHub wiki](https://github.com/riomar0001/lanyard/wiki) by `.github/workflows/wiki.yml` on every push to `main`. Link pages as `Page.md` and images as `../images/x.png`; the workflow rewrites both for the wiki.
- Screenshots live in [`docs/images`](docs/images), 1280×800. Take them from a sandboxed instance with demo data, never from a real setup.

## Releases

Releases are built by GitHub Actions from branches named `build-v<version>`:

```bash
git push origin main:build-v1.2.0
```

[`release.yml`](.github/workflows/release.yml) then:

1. reads the version from the branch name (it must be valid semver);
2. runs CI;
3. sets that version in the app;
4. builds the Windows installer, the macOS dmgs (Apple Silicon and Intel), the Linux AppImage and the npm tarball, and checks that each one's CLI reports the version;
5. publishes the GitHub release `v1.2.0` with the files, `SHA256SUMS.txt` and generated notes.

A version with a suffix (`1.2.0-beta.1`) is published as a prerelease. Pushing to the same branch again rebuilds that version, moves its tag and replaces its files.

Before releasing, move the **Unreleased** entries in [CHANGELOG.md](CHANGELOG.md) under the new version.
