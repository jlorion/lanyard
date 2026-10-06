/**
 * The contract between the Electron main process and the renderer.
 *
 * The main process implements `LanyardApi`; the renderer gets a typed client for
 * it. Calls travel over a single channel as (namespace, method, args) and the
 * reply is an `IpcResponse` envelope so error codes survive the trip.
 */

import type {
  AccountTestResult,
  AccountView,
  AddAccountInput,
  AddAccountResult,
  AgentStatus,
  BackupInfo,
  BackupKind,
  ConfigValidation,
  CustomProviderInput,
  GenerateKeyInput,
  GitIdentity,
  HostEntry,
  HostInput,
  HostOption,
  KeyInfo,
  KnownHostEntry,
  ProviderInfo,
  ProviderOverview,
  RepoRewriteResult,
  ScannedHostKey,
  Settings,
  LanyardPaths,
  TestResult,
  TrashResult,
  UpdateAccountInput,
  UseResult,
} from './types';

export const IPC_CHANNELS = {
  invoke: 'lanyard:invoke',
  /** main -> renderer: files on disk changed (config, known_hosts, state). */
  changed: 'lanyard:changed',
  /** main -> renderer: the tray asked to show a page. */
  navigate: 'lanyard:navigate',
} as const;

export type ChangeTopic = 'config' | 'knownHosts' | 'state' | 'keys';

export interface AppInfo {
  version: string;
  platform: 'win32' | 'darwin' | 'linux' | (string & {});
  paths: LanyardPaths;
  terminalChoices: string[];
  /** Command that runs the CLI from this installation. */
  cliHint: string;
}

export interface LanyardApi {
  accounts: {
    overview(): Promise<ProviderOverview[]>;
    add(input: AddAccountInput): Promise<AddAccountResult>;
    update(provider: string, name: string, patch: UpdateAccountInput): Promise<AccountView>;
    remove(provider: string, name: string, options?: { deleteKey?: boolean }): Promise<{ removed: string; trashed: TrashResult | null }>;
    use(provider: string, name: string | null): Promise<UseResult>;
    test(provider: string, name?: string): Promise<AccountTestResult>;
    cloneUrl(provider: string, name: string, repoUrl: string): Promise<string>;
    applyToRepo(provider: string, name: string, dir: string, options?: { remote?: string; setIdentity?: boolean }): Promise<RepoRewriteResult>;
    addProvider(input: CustomProviderInput): Promise<ProviderInfo>;
    removeProvider(id: string): Promise<{ removed: string }>;
  };
  hosts: {
    list(): Promise<HostEntry[]>;
    save(host: HostInput): Promise<HostEntry[]>;
    remove(index: number, patterns: string): Promise<HostEntry[]>;
    /** Switch the IdentityFile of a host; null returns to ssh's default keys. */
    setKey(alias: string, keyRef: string | null): Promise<HostEntry>;
    getRaw(): Promise<string>;
    validate(text: string): Promise<ConfigValidation>;
    saveRaw(text: string, options?: { force?: boolean }): Promise<{ saved: boolean }>;
    test(alias: string): Promise<TestResult>;
    resolve(alias: string): Promise<HostOption[]>;
  };
  keys: {
    list(): Promise<KeyInfo[]>;
    generate(input: GenerateKeyInput): Promise<KeyInfo>;
    publicKey(ref: string): Promise<string>;
    changePassphrase(ref: string, oldPassphrase: string, newPassphrase: string): Promise<KeyInfo>;
    remove(ref: string): Promise<TrashResult>;
    fixPermissions(ref: string): Promise<{ message: string }>;
  };
  knownHosts: {
    list(): Promise<KnownHostEntry[]>;
    removeLine(line: number, fingerprint: string): Promise<void>;
    removeHost(host: string, port?: string): Promise<{ removed: boolean }>;
    scan(host: string, port?: string): Promise<ScannedHostKey[]>;
    trust(lines: string[]): Promise<{ added: number }>;
  };
  agent: {
    status(): Promise<AgentStatus>;
    add(ref: string): Promise<{ added: string }>;
    remove(ref: string): Promise<{ removed: string }>;
    clear(): Promise<{ cleared: true }>;
  };
  backups: {
    list(kind?: BackupKind): Promise<BackupInfo[]>;
    read(id: string): Promise<string>;
    restore(id: string): Promise<BackupKind>;
  };
  git: {
    identity(): Promise<GitIdentity>;
    setSshCommand(command: string): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: Partial<Settings>): Promise<Settings>;
  };
  app: {
    info(): Promise<AppInfo>;
    openExternal(url: string): Promise<void>;
    copy(text: string): Promise<void>;
    pickDirectory(): Promise<string | null>;
    pickFile(): Promise<string | null>;
    /** Open a terminal running `ssh <alias>`. */
    connect(alias: string): Promise<void>;
    /** Open a terminal running `ssh-add <key>` so the passphrase can be typed. */
    addKeyInTerminal(ref: string): Promise<void>;
    revealPath(path: string): Promise<void>;
    /** Match native window chrome to the renderer theme. */
    setTheme(mode: 'system' | 'light' | 'dark'): Promise<void>;
  };
}

export type ApiNamespace = keyof LanyardApi;

export type IpcResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/** What the preload script exposes on `window.lanyard`. */
export interface PreloadBridge {
  invoke(namespace: string, method: string, args: unknown[]): Promise<IpcResponse>;
  onChanged(listener: (topics: ChangeTopic[]) => void): () => void;
  onNavigate(listener: (page: string) => void): () => void;
}
