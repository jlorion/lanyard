/**
 * Main-process implementation of the IPC contract. Domain calls are delegated
 * to the core; only desktop concerns (dialogs, clipboard, terminals, shell)
 * live here.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, clipboard, dialog, Menu, nativeTheme, shell } from 'electron';
import * as core from '../../core';
import { toolVersions } from '../../core/utils/tool-versions';
import pkg from '../../../package.json';
import type { AboutInfo, AppInfo, LanyardApi } from '../../shared/ipc';
import type { MainWindow } from '../window';
import * as cliInstall from '../cli-install';

export interface ApiContext {
  window: MainWindow;
  /** Called after settings change so OS integration (login item, tray) can follow. */
  onSettingsChanged: () => void;
}

function cliHint(): string {
  if (app.isPackaged) {
    const shim = process.platform === 'win32' ? 'lanyard.cmd' : 'lanyard';
    return `"${path.join(process.resourcesPath, 'cli', shim)}"`;
  }
  return `node "${path.join(app.getAppPath(), 'bin', 'lanyard.js')}"`;
}

export function openInTerminal(cmd: string, args: string[], title: string): void {
  core.terminal.openTerminal(cmd, args, { preference: core.settings.get().terminal, title });
}

export function createApi(ctx: ApiContext): LanyardApi {
  const parent = () => ctx.window.browserWindow ?? undefined;

  async function pick(properties: Electron.OpenDialogOptions['properties'], defaultPath?: string) {
    const win = parent();
    const options: Electron.OpenDialogOptions = { properties, defaultPath };
    const r = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
  }

  return {
    accounts: {
      overview: async () => core.accounts.overview(),
      add: (input) => core.accounts.add(input),
      update: (provider, name, patch) => core.accounts.update(provider, name, patch),
      remove: (provider, name, options) => core.accounts.remove(provider, name, options),
      use: (provider, name) => core.accounts.use(provider, name),
      test: (provider, name) => core.accounts.test(provider, name),
      cloneUrl: async (provider, name, repoUrl) => core.accounts.cloneUrl(provider, name, repoUrl),
      applyToRepo: (provider, name, dir, options) => core.accounts.applyToRepo(provider, name, dir, options),
      addProvider: async (input) => core.accounts.addProvider(input),
      removeProvider: async (id) => core.accounts.removeProvider(id),
    },
    hosts: {
      list: async () => core.hosts.list(),
      save: async (host) => core.hosts.save(host),
      remove: async (index, patterns) => core.hosts.remove(index, patterns),
      setKey: async (alias, keyRef) => core.hosts.setKey(alias, keyRef),
      getRaw: async () => core.hosts.getRaw(),
      validate: (text) => core.hosts.validate(text),
      saveRaw: (text, options) => core.hosts.saveRaw(text, options),
      test: (alias) => core.hosts.test(alias),
      resolve: (alias) => core.hosts.resolve(alias),
    },
    keys: {
      list: async () => core.keys.list(),
      generate: (input) => core.keys.generate(input),
      checkName: async (name) => core.keys.checkName(name),
      publicKey: (ref) => core.keys.publicKey(ref),
      changePassphrase: (ref, oldP, newP) => core.keys.changePassphrase(ref, oldP, newP),
      remove: async (ref) => core.keys.remove(ref),
      fixPermissions: (ref) => core.keys.fixPermissions(ref),
    },
    knownHosts: {
      list: async () => core.knownHosts.list(),
      removeLine: async (line, fingerprint) => core.knownHosts.removeLine(line, fingerprint),
      removeHost: (host, port) => core.knownHosts.removeHost(host, port),
      scan: (host, port) => core.knownHosts.scan(host, port),
      trust: async (lines) => core.knownHosts.trust(lines),
    },
    agent: {
      status: () => core.agent.status(),
      add: (ref) => core.agent.add(ref),
      remove: (ref) => core.agent.remove(ref),
      clear: () => core.agent.clear(),
    },
    backups: {
      list: async (kind) => core.backups.list(kind),
      read: async (id) => core.backups.read(id),
      restore: async (id) => core.backups.restore(id),
    },
    git: {
      identity: () => core.git.getGlobalIdentity(),
      setSshCommand: (command) => core.git.setSshCommand(command),
    },
    settings: {
      get: async () => core.settings.get(),
      update: async (patch) => {
        const next = core.settings.update(patch);
        ctx.onSettingsChanged();
        return next;
      },
    },
    app: {
      info: async (): Promise<AppInfo> => ({
        version: app.getVersion(),
        platform: process.platform,
        paths: core.describePaths(),
        terminalChoices: core.terminal.TERMINAL_CHOICES[process.platform] ?? ['auto'],
        cliHint: cliHint(),
      }),
      openExternal: async (url) => {
        if (!/^https:\/\//.test(url)) throw new Error('Only https links can be opened.');
        await shell.openExternal(url);
      },
      copy: async (text) => clipboard.writeText(text),
      pickDirectory: () => pick(['openDirectory']),
      pickFile: () => pick(['openFile', 'showHiddenFiles'], core.paths.sshDir),
      connect: async (alias) => {
        const provider = core.hosts.gitProviderFor(core.hosts.assertAlias(alias));
        if (provider) throw new core.LanyardError(`${alias} is a ${provider} git host: it accepts git over SSH but has no shell. Use Test instead.`, 'GIT_HOST');
        openInTerminal('ssh', [alias], `ssh ${alias}`);
      },
      addKeyInTerminal: async (ref) => {
        const { cmd, args } = core.agent.interactiveAddCommand(ref);
        openInTerminal(cmd, args, 'ssh-add');
      },
      about: async (): Promise<AboutInfo> => ({
        name: pkg.productName,
        version: app.getVersion(),
        description: pkg.description,
        license: pkg.license,
        runtime: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
        os: `${os.type()} ${os.release()} (${os.arch()})`,
        tools: await toolVersions(),
        packaged: app.isPackaged,
      }),
      showAppMenu: async (x, y) => {
        const win = ctx.window.browserWindow;
        if (win) Menu.getApplicationMenu()?.popup({ window: win, x: Math.round(x), y: Math.round(y) });
      },
      cliStatus: () => cliInstall.status(),
      installCli: () => cliInstall.install(),
      uninstallCli: () => cliInstall.uninstall(),
      setTheme: async (mode) => {
        nativeTheme.themeSource = mode;
      },
      setTitleBarColors: async (color, symbolColor) => {
        if (![color, symbolColor].every((c) => /^#[0-9a-f]{6}$/i.test(c))) throw new Error('Colours must be #rrggbb.');
        ctx.window.setTitleBarColors(color, symbolColor);
      },
      revealPath: async (target) => {
        if (!fs.existsSync(target)) throw new Error(`Not found: ${target}`);
        shell.showItemInFolder(target);
      },
    },
  };
}
