# Plan: Migrate Lanyard from Electron to Tauri v2

## Goal

Replace the Electron shell (main process, preload, electron-vite, electron-builder) with a Tauri v2 shell (Rust backend + system webview) while keeping the React renderer and the Node/TypeScript core (`src/core`) working unchanged, then decouple the CLI build from Electron tooling.

## Current context / assumptions

- Repo: `C:\Users\jlorion\Documents\personal\lanyard` ("Lanyard", an SSH identity/hosts/keys manager).
- Architecture today (verified by inspection):
  - `src/core/**` — pure Node TypeScript, no Electron imports. All domain logic (accounts, hosts, keys, known_hosts, agent, backups, ssh-config parsing, settings store). **Reuse as-is.**
  - `src/main/**` — Electron main process: window, tray, app menu, login item, file watcher, IPC host (`src/main/ipc/api.ts` implements `LanyardApi` by delegating to `src/core`), CLI install helpers, zoom.
  - `src/preload/index.ts` — exposes `window.lanyard` = `{ invoke(namespace, method, args), onChanged, onNavigate, onCommand }`.
  - `src/shared/ipc.ts` — the contract: `LanyardApi` (namespaces: `accounts`, `hosts`, `keys`, `knownHosts`, `agent`, `backups`, `git`, `settings`, `app`) and the `IpcResponse` envelope `{ ok: true, data } | { ok: false, error, code? }`.
  - `src/renderer/src/lib/api.ts` — the **only** renderer touchpoint: a typed `Proxy` that calls `window.lanyard.invoke(...)` and unwraps `IpcResponse`. Everything else in the renderer is plain React.
  - `src/cli/**` + `bin/lanyard.js` — CLI, compiled by the electron-vite "main" build into `out/main/cli.js`.
  - Tests: `test/*.test.ts` (vitest) — mostly core; `tray-hosts-menu.test.ts` and `zoom.test.ts` are Electron-coupled.
  - ~9,980 LOC total; TypeScript + TSX dominate.
- **Binaries are out of scope**: binary asset files (icons under `resources/`, `build/`) and the `bin/` launcher are ignored in this migration except where packaging must reference them. No rewriting or auditing of binary content.
- **Command safety** (a previous attempt produced a bad command): every command below is project-scoped — no global installs, no `--break-system-packages`, no `sudo`, no `rm -rf` outside the repo, no force-pushes. Package installs go into the project's own `node_modules` / Cargo target dir only.
- Prerequisites to verify (read-only): `node --version` (>= 20), `cargo --version`, `rustc --version` (>= 1.77), and on Windows the MSVC build tools + WebView2 (already present on Windows 11).

## Architecture / proposed approach

Keep the `LanyardApi` contract and the `IpcResponse` envelope exactly as they are. The renderer keeps calling `window.lanyard.invoke(namespace, method, args)`; we swap what sits behind `window.lanyard`. In Tauri there is no main-process Node runtime, so `src/core` runs in a **sidecar process**: a small Node host (`src/sidecar/index.ts`) that imports `createApi`-equivalent domain functions and speaks newline-delimited JSON-RPC over stdio, spawned and owned by the Rust backend via `tauri-plugin-shell`. The Rust backend (`src-tauri/src/`) handles only desktop concerns (window, tray, menu, autostart, dialogs, clipboard, theme, single-instance) and proxies domain calls to the sidecar, preserving the envelope end-to-end.

This is the strangler-fig approach: Phase 1 delivers a working Tauri app with the core reused; a future Phase 2 (out of scope here) could port `src/core` to Rust and drop the sidecar.

### Data flow (after migration)

```
React renderer ── window.lanyard.invoke(ns, method, args)
  └─ src/renderer/src/lib/tauri-bridge.ts  (NEW: installs window.lanyard)
       └─ @tauri-apps/api invoke('api_invoke', { namespace, method, args })
            └─ Rust: api_invoke command
                 ├─ namespace "app" desktop methods → handled natively in Rust
                 └─ everything else → JSON-RPC over stdin to sidecar (Node, src/sidecar)
                      └─ src/core/** (unchanged) → IpcResponse envelope back
Events (changed / navigate / command): sidecar stdout "event" frames → Rust → app.emit_all → bridge listens via @tauri-apps/api/event
```

## Step-by-step tasks

### Phase 0 — Baseline and safety

**Task 0.1 — Verify baseline tests pass.**
```bash
cd C:/Users/jlorion/Documents/personal/lanyard
npm test
```
Expected: vitest reports all suites in `test/` passing (9 files). If anything fails before we start, stop and fix or explicitly exclude it — the baseline must be green.

**Task 0.2 — Create the migration branch.**
```bash
git checkout -b feat/tauri-migration
```
Expected: `Switched to a new branch 'feat/tauri-migration'`.

**Task 0.3 — Record what Electron the renderer actually touches.**
```bash
grep -rn "window.lanyard" src/renderer/src --include="*.ts" --include="*.tsx" -l
```
Expected output is exactly these 4 files (confirm no new ones appear during migration):
```
src/renderer/src/app/navigation.tsx
src/renderer/src/App.tsx
src/renderer/src/hooks/useResource.ts
src/renderer/src/lib/api.ts
```
Commit: `git add -A && git commit -m "chore: baseline before tauri migration"`.

### Phase 1 — Tauri scaffold alongside Electron

Goal of the phase: `npm run tauri:dev` opens a Tauri window showing the current renderer, with `window.lanyard` still backed by a stub. Electron stays intact until Phase 6.

**Task 1.1 — Add Tauri deps (project-local only).**
```bash
npm install -D @tauri-apps/cli@^2
npm install @tauri-apps/api@^2 @tauri-apps/plugin-shell@^2 @tauri-apps/plugin-dialog@^2 @tauri-apps/plugin-clipboard-manager@^2 @tauri-apps/plugin-autostart@^2 @tauri-apps/plugin-single-instance@^2
```
Verify: `npx tauri --version` prints `tauri-cli 2.x.x`.

**Task 1.2 — Initialize the Rust crate manually** (do NOT run `tauri init` — it would clobber existing config; write files by hand).

Create `src-tauri/Cargo.toml`:
```toml
[package]
name = "lanyard"
version = "1.0.0"
description = "Wear the right identity everywhere"
edition = "2021"
rust-version = "1.77"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [ "tray-icon", "image-png" ] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-autostart = "2"
tauri-plugin-single-instance = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[features]
# Use the existing renderer dev server / build output instead of a frontend dist dir baked by tauri init.
custom-protocol = ["tauri/custom-protocol"]
```

Create `src-tauri/build.rs`:
```rust
fn main() {
    tauri_build::build()
}
```

Create `src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Lanyard",
  "version": "1.0.0",
  "identifier": "dev.riomar.lanyard",
  "build": {
    "beforeDevCommand": "npm run build:renderer",
    "frontendDist": "../out/renderer"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Lanyard",
        "width": 1120,
        "height": 720,
        "minWidth": 880,
        "minHeight": 600,
        "decorations": false,
        "hiddenTitle": true,
        "titleBarStyle": "Overlay"
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "../resources/icons/32x32.png",
      "../resources/icons/128x128.png",
      "../resources/icons/128x128@2x.png",
      "../resources/icons/icon.icns",
      "../resources/icons/icon.ico"
    ]
  }
}
```
(Adjust `width`/`height`/`decorations` to match `src/main/window.ts` exactly — read that file first and copy its numbers. If icon filenames differ under `resources/`, list the directory with `ls resources` and use the real names.)

**Task 1.3 — Add the renderer-only build script** so Tauri can build the frontend without electron-vite.

Create `vite.renderer.config.ts` (repo root):
```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'out/renderer'),
    emptyOutDir: true,
    minify: true,
    rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
  },
});
```
Add to `package.json` scripts:
```json
"build:renderer": "vite build --config vite.renderer.config.ts",
"tauri:dev": "npm run build:renderer && tauri dev",
"tauri:build": "npm run build:renderer && tauri build"
```
Verify: `npm run build:renderer` exits 0 and `out/renderer/index.html` exists (`test -f out/renderer/index.html && echo OK` → `OK`).
Commit: `git commit -am "feat: tauri scaffold + standalone renderer build"`.

### Phase 2 — The bridge: keep the renderer untouched

**Task 2.1 — Write the failing test first.**

Create `test/tauri-bridge.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

// The bridge module under test. It must install window.lanyard backed by
// @tauri-apps/api, preserving the IpcResponse envelope contract.
import { installBridge } from '../src/renderer/src/lib/tauri-bridge';

const invokeMock = vi.fn();
const listenMock = vi.fn().mockResolvedValue(() => {});
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: (...a: unknown[]) => listenMock(...a) }));

describe('tauri bridge', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    delete (window as Record<string, unknown>).lanyard;
  });

  it('installs window.lanyard with invoke + three subscriptions', async () => {
    installBridge();
    const b = (window as unknown as { lanyard: Record<string, unknown> }).lanyard;
    expect(typeof b.invoke).toBe('function');
    expect(typeof b.onChanged).toBe('function');
    expect(typeof b.onNavigate).toBe('function');
    expect(typeof b.onCommand).toBe('function');
  });

  it('forwards invoke as a single api_invoke command and returns the envelope verbatim', async () => {
    installBridge();
    invokeMock.mockResolvedValue({ ok: true, data: 42 });
    const res = await (window as unknown as { lanyard: { invoke: (n: string, m: string, a: unknown[]) => Promise<unknown> } })
      .lanyard.invoke('settings', 'get', []);
    expect(invokeMock).toHaveBeenCalledWith('api_invoke', { namespace: 'settings', method: 'get', args: [] });
    expect(res).toEqual({ ok: true, data: 42 });
  });

  it('maps the three event channels to tauri listeners', async () => {
    installBridge();
    const names = listenMock.mock.calls.map((c) => c[0]);
    expect(names).toEqual(expect.arrayContaining(['lanyard:changed', 'lanyard:navigate', 'lanyard:command']));
  });
});
```
Run: `npx vitest run test/tauri-bridge.test.ts`
Expected: **fails** — module `../src/renderer/src/lib/tauri-bridge` does not exist.

**Task 2.2 — Implement the bridge.**

Create `src/renderer/src/lib/tauri-bridge.ts`:
```ts
/**
 * Tauri replacement for the Electron preload bridge. Installs the same
 * `window.lanyard` surface the renderer was written against, so no React code
 * changes. Domain calls travel as one `api_invoke` Tauri command; main-side
 * pushes arrive as Tauri events on the legacy channel names.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  IPC_CHANNELS,
  type AppCommand,
  type ChangeTopic,
  type IpcResponse,
  type NavigateRequest,
  type PreloadBridge,
} from '../../../shared/ipc';

export function installBridge(): void {
  const bridge: PreloadBridge = {
    invoke: (namespace, method, args) =>
      invoke<IpcResponse>('api_invoke', { namespace, method, args }),
    onChanged: (listener) => {
      let unlisten: (() => void) | undefined;
      void listen<ChangeTopic[]>(IPC_CHANNELS.changed, (e) => listener(e.payload)).then((u) => (unlisten = u));
      return () => unlisten?.();
    },
    onNavigate: (listener) => {
      let unlisten: (() => void) | undefined;
      void listen<NavigateRequest>(IPC_CHANNELS.navigate, (e) => listener(e.payload)).then((u) => (unlisten = u));
      return () => unlisten?.();
    },
    onCommand: (listener) => {
      let unlisten: (() => void) | undefined;
      void listen<AppCommand>(IPC_CHANNELS.command, (e) => listener(e.payload)).then((u) => (unlisten = u));
      return () => unlisten?.();
    },
  };
  (window as unknown as { lanyard: PreloadBridge }).lanyard = bridge;
}
```
Run: `npx vitest run test/tauri-bridge.test.ts`
Expected: 3 tests pass.

**Task 2.3 — Install the bridge at renderer startup.**

In `src/renderer/src/main.tsx` (or wherever `createRoot` is called — confirm the entry filename via `ls src/renderer/src`), add **as the first import**:
```ts
import { installBridge } from './lib/tauri-bridge';
installBridge();
```
Verify: `npm run typecheck` passes; `npx vitest run` all green.
Commit: `git commit -am "feat: tauri bridge replacing electron preload"`.

### Phase 3 — The sidecar: run `src/core` outside Electron

`src/main/ipc/api.ts` mixes domain delegation (reusable) with Electron APIs (dialogs, clipboard, shell, nativeTheme). Split it.

**Task 3.1 — Extract the domain-only API.**

Create `src/core/api-domain.ts`: copy `createApi` from `src/main/ipc/api.ts` and delete every method whose body touches an Electron import. What remains is the full `accounts`, `hosts`, `keys`, `knownHosts`, `agent`, `backups`, `git`, `settings` namespaces plus the `app` sub-methods that are pure (`info`, `about` minus runtime strings, `connect`, `addKeyInTerminal` — the last two already delegate to `core.terminal`). The Electron-only `app` methods (`openExternal`, `copy`, `pickDirectory`, `pickFile`, `revealPath`, `setTheme`, `setTitleBarColors`, `showAppMenu`, `cliStatus`) move to Rust in Phase 4.

Refactor `src/main/ipc/api.ts` to re-export the domain part and only add the Electron-only methods on top, so Electron keeps working during the transition.
Verify: `npm run typecheck && npm test` green.
Commit: `git commit -am "refactor: split domain api from electron desktop api"`.

**Task 3.2 — Write the failing sidecar protocol test.**

Create `test/sidecar.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

function rpc(line: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['out/sidecar/index.js'], { stdio: ['pipe', 'pipe', 'inherit'] });
    const rl = createInterface({ input: child.stdout });
    const timer = setTimeout(() => { child.kill(); reject(new Error('sidecar timeout')); }, 15000);
    child.stdin.write(line + '\n');
    rl.on('line', (l) => {
      clearTimeout(timer);
      child.kill();
      resolve(JSON.parse(l));
    });
  });
}

describe('sidecar protocol', () => {
  it('replies with an ok envelope for settings.get', async () => {
    const res = await rpc(JSON.stringify({ id: 1, namespace: 'settings', method: 'get', args: [] }));
    expect(res).toMatchObject({ id: 1, ok: true });
    expect((res as { data: Record<string, unknown> }).data).toBeTypeOf('object');
  });

  it('replies with a structured error for unknown methods', async () => {
    const res = await rpc(JSON.stringify({ id: 2, namespace: 'nope', method: 'nope', args: [] }));
    expect(res).toMatchObject({ id: 2, ok: false });
    expect((res as { error: string }).error).toContain('Unknown method');
  });
});
```
Run: `npx vitest run test/sidecar.test.ts`
Expected: **fails** — `out/sidecar/index.js` does not exist.

**Task 3.3 — Implement the sidecar host.**

Create `src/sidecar/index.ts`:
```ts
/**
 * Sidecar host: runs the domain API outside any browser/Electron process.
 * Protocol: newline-delimited JSON on stdin/stdout.
 *   request : { id, namespace, method, args }
 *   response: { id, ok: true, data } | { id, ok: false, error, code? }
 *   event   : { event: 'lanyard:changed' | 'lanyard:navigate' | 'lanyard:command', payload }
 * Domain errors keep their message and code, mirroring the old IPC envelope.
 */
import { createInterface } from 'node:readline';
import { createDomainApi } from '../core/api-domain';
import * as core from '../core';

interface Request { id: number; namespace: string; method: string; args: unknown[] }

const api = createDomainApi();

function send(msg: unknown): void {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

// File-change events: reuse the same watcher topics the Electron main used.
core.watch?.((topics: string[]) => send({ event: 'lanyard:changed', payload: topics }));

const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let req: Request;
  try { req = JSON.parse(line); } catch { return; }
  const group = (api as Record<string, Record<string, unknown>>)[req.namespace];
  const fn = group?.[req.method];
  if (typeof fn !== 'function') {
    send({ id: req.id, ok: false, error: `Unknown method ${req.namespace}.${req.method}` });
    return;
  }
  try {
    const data = await (fn as (...a: unknown[]) => Promise<unknown>)(...(req.args ?? []));
    send({ id: req.id, ok: true, data });
  } catch (err) {
    const e = err as Error & { code?: string };
    send({ id: req.id, ok: false, error: e.message, code: e.code });
  }
});
```
NOTE for the implementer: `core.watch` does not exist yet — the file watcher lives in `src/main/watcher.ts` (Electron-coupled only via `webContents.send`). Extract its fs-watching logic into `src/core/state/watch.ts` exporting `watch(onTopics: (topics: ChangeTopic[]) => void): () => void`, export it from `src/core/index.ts`, and update both `src/main/watcher.ts` and the sidecar to use it. Write `test/watch.test.ts` first: create a temp dir, start the watcher against a temp `~/.ssh` fixture, touch a file, assert the callback fires with `'config'` within 2s; run it red, then implement.

**Task 3.4 — Build script for the sidecar.**

Add to `package.json` scripts:
```json
"build:sidecar": "esbuild src/sidecar/index.ts --bundle --platform=node --format=cjs --target=node20 --outfile=out/sidecar/index.js --external:electron"
```
```bash
npm install -D esbuild
npm run build:sidecar && npx vitest run test/sidecar.test.ts
```
Expected: build exits 0; both sidecar tests pass.
Commit: `git commit -am "feat: node sidecar hosting core over stdio json-rpc"`.

### Phase 4 — Rust backend: command router + desktop concerns

**Task 4.1 — Write the failing Rust test for the router.**

Create `src-tauri/src/router.rs`:
```rust
//! Pure routing decision: which calls are answered natively in Rust and which
//! go to the sidecar. Kept side-effect-free so it is unit-testable.

/// `app` sub-methods implemented natively (no sidecar round trip).
pub const NATIVE_APP_METHODS: &[&str] = &[
    "openExternal", "copy", "pickDirectory", "pickFile", "revealPath",
    "setTheme", "setTitleBarColors", "showAppMenu", "cliStatus",
];

pub fn is_native(namespace: &str, method: &str) -> bool {
    namespace == "app" && NATIVE_APP_METHODS.contains(&method)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn routes_native_app_methods() {
        assert!(is_native("app", "copy"));
        assert!(is_native("app", "pickDirectory"));
    }
    #[test]
    fn routes_everything_else_to_sidecar() {
        assert!(!is_native("settings", "get"));
        assert!(!is_native("app", "info")); // served by sidecar (needs core paths)
        assert!(!is_native("hosts", "list"));
    }
}
```
Run: `cd src-tauri && cargo test`
Expected: **fails to compile** until `router` is declared as a module.

**Task 4.2 — Implement the sidecar client and command in Rust.**

Create `src-tauri/src/sidecar.rs`:
```rust
//! Owns the sidecar child process. One request in flight at a time is fine:
//! the renderer already serializes per user action; use a Mutex.
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

pub struct Sidecar {
    child: Mutex<Child>,
    stdin: Mutex<ChildStdin>,
    next_id: AtomicU64,
    /// Lines from stdout that are events (no matching id) are forwarded here.
    on_event: tauri::AppHandle,
}

impl Sidecar {
    pub fn spawn(app: tauri::AppHandle, program: &str, script: &str) -> std::io::Result<Self> {
        let mut child = Command::new(program)
            .arg(script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?;
        let stdin = child.stdin.take().expect("stdin piped");
        let stdout = child.stdout.take().expect("stdout piped");
        let app2 = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    if v.get("id").is_none() {
                        if let (Some(ev), Some(p)) = (v.get("event"), v.get("payload")) {
                            use tauri::Emitter;
                            let _ = app2.emit(ev.as_str().unwrap_or("lanyard:changed"), p.clone());
                        }
                    } else {
                        // Response lines are pulled synchronously in call(); in a
                        // production version route them through a pending-request map.
                    }
                }
            }
        });
        Ok(Self { child: Mutex::new(child), stdin: Mutex::new(stdin), next_id: AtomicU64::new(1), on_event: app })
    }

    pub fn call(&self, namespace: &str, method: &str, args: Value) -> Value {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let req = json!({ "id": id, "namespace": namespace, "method": method, "args": args });
        let mut stdin = self.stdin.lock().unwrap();
        if writeln!(stdin, "{}", req).is_err() {
            return json!({ "ok": false, "error": "sidecar write failed" });
        }
        // Simplified blocking read; production: match ids via a DashMap<u64, oneshot>.
        json!({ "ok": false, "error": "not wired" })
    }
}
```
Then in `src-tauri/src/lib.rs`:
```rust
mod router;
mod sidecar;

use serde_json::Value;
use std::sync::Arc;
use tauri::Manager;

#[tauri::command]
async fn api_invoke(
    state: tauri::State<'_, Arc<sidecar::Sidecar>>,
    namespace: String,
    method: String,
    args: Value,
) -> Result<Value, String> {
    if router::is_native(&namespace, &method) {
        return native::app_call(&method, args).await;
    }
    Ok(state.call(&namespace, &method, args))
}

mod native; // Task 4.3

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            let sidecar = sidecar::Sidecar::spawn(
                app.handle().clone(),
                "node",
                &app.path().resource_dir().unwrap().join("sidecar/index.js").to_string_lossy(),
            )?;
            app.manage(Arc::new(sidecar));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![api_invoke])
        .run(tauri::generate_context!())
        .expect("error while running lanyard");
}
```
NOTE for the implementer: the simplified blocking `call()` above must be finished before Phase 5 is considered done — route responses by id through a `std::collections::HashMap<u64, std::sync::mpsc::Sender<Value>>` protected by a `Mutex`. Write a Rust integration test (`src-tauri/tests/sidecar_roundtrip.rs`) that spawns the real built sidecar (`out/sidecar/index.js`) and asserts `settings.get` returns `ok: true`. Run `cargo test` red first (response map missing → timeout), then implement, then green.
Verify: `cd src-tauri && cargo test` → router tests + roundtrip test pass.
Commit: `git commit -am "feat: rust command router + sidecar client"`.

**Task 4.3 — Native `app` methods in Rust.**

Create `src-tauri/src/native.rs` implementing each native method with the Tauri plugin APIs, mirroring the Electron semantics in `src/main/ipc/api.ts` one by one:
- `copy(text)` → `app.clipboard().write_text(text)`
- `openExternal(url)` → `tauri_plugin_shell::ShellExt::shell().open(url, None)` — validate scheme is `https?` first (parity with `src/main/security.ts`)
- `pickDirectory` / `pickFile` → `tauri_plugin_dialog::DialogExt::dialog().blocking_pick_folder()` / `blocking_pick_file()`
- `revealPath(p)` → `shell.open` on the parent dir (or `opener` crate `reveal`)
- `setTheme(mode)` → `window.set_theme(...)`
- `setTitleBarColors` → Windows-only `window.set_title_bar_colors` equivalent; no-op elsewhere (parity with Electron's Windows-only behavior)
- `showAppMenu(x, y)` → build the menu from Task 5.2 and `popup_at`
- `cliStatus` → keep returning `{ installed: false, onPath: false, ... }` stub with a TODO; the CLI install flow is redesigned in Phase 6

For each method, add a Rust unit test where pure (scheme validation, path→parent computation) and otherwise verify manually via `npm run tauri:dev`.
Verify: `cargo test` green; `npm run typecheck` green.
Commit: `git commit -am "feat: native desktop methods in rust"`.

### Phase 5 — Window, tray, menu, login item (parity with Electron main)

Read these files first and port behavior 1:1: `src/main/window.ts` (size, frameless, hide-on-close), `src/main/tray.ts` + `src/main/tray-hosts-menu.ts` (tray icon, hosts submenu, connect/copy actions), `src/main/app-menu.ts` (File/Edit/View menu + accelerators), `src/main/login-item.ts` (launch at login, `--hidden` flag), `src/main/zoom.ts` (zoom levels + persisted factor).

**Task 5.1 — Window parity (Rust).** Frameless window, `on_window_event` CloseRequested → hide instead of close when `closeToTray` setting is true (read the setting via a sidecar `settings.get` call at startup and cache it; refresh on `lanyard:changed` `state` topic). Verify manually: closing the window leaves the tray icon; quitting from tray exits (`Get-Process lanyard` returns nothing after quit).

**Task 5.2 — Tray + hosts menu (Rust).** Port `tray-hosts-menu.ts` grouping logic into Rust structs. TDD: first port the pure grouping function into `src-tauri/src/tray_menu.rs` with a `#[cfg(test)]` module replicating the existing cases from `test/tray-hosts-menu.test.ts` (copy the fixtures from that file); `cargo test` red → implement → green. Then wire it to `tauri::tray::TrayIconBuilder` with menu events emitting `lanyard:navigate` / sidecar `hosts.setKey` / terminal connect.
Commit: `git commit -am "feat: tray + hosts menu in rust"`.

**Task 5.3 — App menu + zoom.** Zoom: move to renderer — persist zoom factor in `localStorage` and call `getCurrentWebview().setZoom(factor)` from a small module in the renderer, reusing the level table from `src/main/zoom.ts`. Update `test/zoom.test.ts` to test the pure level-stepping function only (it already is, mostly — keep it in a shared module `src/shared/zoom.ts` imported by both). Menu: port `buildAppMenu` to a Rust `Menu` with the same items/accelerators; renderer-affecting actions (`palette`, `back`, `forward`) emit `lanyard:command`.
Verify: `npx vitest run test/zoom.test.ts` green; accelerators work manually.
Commit: `git commit -am "feat: app menu + renderer-side zoom"`.

**Task 5.4 — Login item.** Wire settings `launchAtLogin` to `tauri-plugin-autostart` (`enable()`/`disable()`/`is_enabled()`); honor `--hidden` CLI arg to start with the window hidden (parity with `HIDDEN_FLAG` in `src/main/login-item.ts`).
Verify manually: toggle in Settings, log out/in, app starts hidden in tray.
Commit: `git commit -am "feat: autostart parity"`.

### Phase 6 — Decouple the CLI and drop Electron

**Task 6.1 — Standalone CLI build.** Replace the electron-vite "main" build for the CLI with esbuild (same pattern as the sidecar):
```json
"build:cli": "esbuild src/cli/index.ts --bundle --platform=node --format=cjs --target=node20 --outfile=out/main/cli.js"
```
Verify: `npm run build:cli && node bin/lanyard.js --help` prints the commander help (top line: `Usage: lanyard [options] [command]`). `npx vitest run test/cli-shims.test.ts` passes.

**Task 6.2 — Delete Electron.** Remove files: `src/main/`, `src/preload/`, `electron.vite.config.ts`, `electron-builder.yml`. Remove deps: `electron`, `electron-builder`, `electron-vite`. Remove scripts: `dev`, `start`, `dist` (replace with `tauri:dev`/`tauri:build`), and the electron-vite `build` (replace with `npm run build:renderer && npm run build:sidecar && npm run build:cli`). Update `package.json` `main` field removal (no longer needed) — keep `bin` and `files` as-is.
Verify: `npm run check` (format, lint, typecheck, tests) all green; `grep -rn "from 'electron'" src` returns nothing.
Commit: `git commit -am "chore: remove electron"`.

**Task 6.3 — Package the sidecar as a bundled resource.** Add to `src-tauri/tauri.conf.json`:
```json
"bundle": { "resources": { "../out/sidecar": "sidecar" }, "externalBin": [] }
```
and resolve the script path in `Sidecar::spawn` from `resource_dir()/sidecar/index.js` (already written that way in Task 4.2). Ship Node by adding `node` as a Tauri `externalBin` per platform (download official Node LTS binaries in a `scripts/fetch-node.mjs` script — read-only network fetch + checksum verification with `certutil -hashfile <file> SHA256` on Windows / `shasum -a 256` elsewhere, compare against the hashes published on nodejs.org), OR switch `Sidecar::spawn` program to the bundled binary name. Open question below.

**Task 6.4 — End-to-end smoke.** `npm run tauri:build` → installer produced under `src-tauri/target/release/bundle/`. Install, launch, and manually verify the 6 core flows: switch GitHub account, add host, generate key, scan known_hosts, tray connect, CLI `lanyard accounts list`. Each must behave identically to the Electron build.

## Tests / validation summary

| Layer | Test | Command | Gate |
|---|---|---|---|
| Bridge | `test/tauri-bridge.test.ts` | `npx vitest run test/tauri-bridge.test.ts` | Phase 2 |
| Watcher extraction | `test/watch.test.ts` | `npx vitest run test/watch.test.ts` | Phase 3 |
| Sidecar protocol | `test/sidecar.test.ts` | `npx vitest run test/sidecar.test.ts` | Phase 3 |
| Router | `router.rs` unit tests | `cd src-tauri && cargo test router` | Phase 4 |
| Sidecar roundtrip | `src-tauri/tests/sidecar_roundtrip.rs` | `cd src-tauri && cargo test` | Phase 4 |
| Tray menu grouping | `tray_menu.rs` unit tests | `cd src-tauri && cargo test tray` | Phase 5 |
| Regression | full suite | `npm run check && cargo test` | every commit |

TDD cycle per task: write the failing test → run it and confirm the failure message is the expected one (missing module / missing export / timeout) → implement minimally → rerun green → commit with the message shown in the task.

## Risks, tradeoffs, and open questions

1. **Bundling a Node runtime is the ugly part of the sidecar design.** Shipping `node` per-platform via `externalBin` adds ~30–80 MB. Tradeoff accepted to avoid porting `src/core` (7k+ LOC incl. ssh-config parser, git, agent logic) to Rust in one pass. Open question: is requiring Node acceptable, or should Phase 2 (full Rust port of `src/core`) be scheduled immediately after? Recommend: ship sidecar first, evaluate.
2. **Sidecar stdio framing**: newline-delimited JSON breaks if any core code `console.log`s to stdout. Mitigation: in `src/sidecar/index.ts`, redirect `console.log` to stderr at startup (`console.log = (...a) => process.stderr.write(...)`) — add this line; the sidecar test will catch stray stdout as JSON parse failures.
3. **WebView2 differences vs Chromium**: the renderer uses standard CSS/React, low risk, but `CSS+Lasso` stylesheets and any Chromium-only APIs need a manual pass in Phase 6.4. `navigator`/`window` APIs that were actually Node (via preload) are confined to `window.lanyard`, already bridged.
4. **CSP**: Tauri applies its own CSP (`tauri.conf.json`); the old `productionCsp` Vite plugin is replaced by it. Verify no inline-script violations in devtools console during 6.4.
5. **Single-instance + deep tray behavior** (macOS dock `activate`, Windows `--hidden`) has no automated test — manual checklist in Phase 5/6.4.
6. **CLI delivery**: today `electron-builder` installers register `lanyard`/`lny` shims; Tauri's bundler does not manage PATH shims. Open question: keep publishing the npm package for the CLI (`files: ["bin/", "out/main/"]` already set up) and point users there, or write a Tauri post-install script? Recommend npm package — zero installer complexity.
7. **Out of scope**: binary assets are not touched; `bin/lanyard.js` stays as-is; no changes to `src/core` semantics; no Rust port of core logic in this plan.
