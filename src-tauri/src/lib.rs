//! Lanyard Tauri shell. The window loads the React renderer; all domain work
//! happens in the Node sidecar (src/sidecar) behind the single `api_invoke`
//! command, preserving the LanyardApi envelope from the Electron build.

mod native;
mod router;
mod sidecar;
mod tray;

use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

#[tauri::command]
fn api_invoke(
    app: AppHandle,
    namespace: String,
    method: String,
    args: Value,
) -> Result<Value, String> {
    if router::is_native(&namespace, &method) {
        let app2 = app.clone();
        let method2 = method.clone();
        return tauri::async_runtime::block_on(native::app_call(&app2, &method2, args));
    }
    let sidecar = app.state::<Arc<sidecar::Sidecar>>();
    Ok(sidecar.call(&namespace, &method, args))
}

fn sidecar_script(app: &AppHandle) -> (String, String) {
    // Packaged: resources/sidecar/index.js next to the binary; dev: out/sidecar.
    if let Ok(dir) = app.path().resource_dir() {
        let candidate = dir.join("sidecar").join("index.js");
        if candidate.exists() {
            return ("node".into(), candidate.to_string_lossy().into_owned());
        }
    }
    let dev = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../out/sidecar/index.js")
        .canonicalize()
        .expect("out/sidecar/index.js missing — run `npm run build` first");
    ("node".into(), dev.to_string_lossy().into_owned())
}

fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let nav = |label: &str, page: &str, accel: Option<&str>| {
        MenuItem::with_id(app, format!("nav:{page}"), label, true, accel)
    };
    let pages = Submenu::new(app, "Go", true)?;
    for (i, (label, page)) in [
        ("Overview", "overview"),
        ("Git accounts", "accounts"),
        ("Hosts", "hosts"),
        ("Keys", "keys"),
        ("ssh-agent", "agent"),
        ("Known hosts", "known-hosts"),
        ("Backups", "backups"),
        ("Settings", "settings"),
    ]
    .iter()
    .enumerate()
    {
        pages.append(&nav(label, page, Some(&format!("CmdOrCtrl+{}", i + 1))))?;
    }

    let file = Submenu::new(app, "File", true)?;
    file.append(&nav("Add Git Account…", "accounts:add-account", Some("CmdOrCtrl+N")))?;
    file.append(&nav("Add Host…", "hosts:add-host", Some("CmdOrCtrl+Shift+N")))?;
    file.append(&nav("Generate SSH Key…", "keys:generate-key", None))?;
    file.append(&nav("Scan Host Keys…", "known-hosts:scan-host", None))?;
    file.append(&PredefinedMenuItem::separator(app)?)?;
    file.append(&nav("Edit Raw SSH Config", "hosts:raw-config", None))?;
    file.append(&nav("Settings…", "settings", Some("CmdOrCtrl+,")))?;
    file.append(&PredefinedMenuItem::separator(app)?)?;
    file.append(&MenuItem::with_id(app, "app:quit", "Quit Lanyard", true, Some("CmdOrCtrl+Q"))?)?;

    let edit = Submenu::new(app, "Edit", true)?;
    for item in [
        PredefinedMenuItem::undo(app, None)?,
        PredefinedMenuItem::redo(app, None)?,
        PredefinedMenuItem::separator(app)?,
        PredefinedMenuItem::cut(app, None)?,
        PredefinedMenuItem::copy(app, None)?,
        PredefinedMenuItem::paste(app, None)?,
        PredefinedMenuItem::select_all(app, None)?,
    ] {
        edit.append(&item)?;
    }

    let view = Submenu::new(app, "View", true)?;
    view.append(&MenuItem::with_id(app, "cmd:palette", "Command Palette…", true, Some("CmdOrCtrl+K"))?)?;
    view.append(&PredefinedMenuItem::separator(app)?)?;
    view.append(&PredefinedMenuItem::fullscreen(app, None)?)?;
    if cfg!(debug_assertions) {
        view.append(&PredefinedMenuItem::separator(app)?)?;
    }

    let menu = Menu::new(app)?;
    for sub in [file, edit, view, pages] {
        menu.append(&sub)?;
    }
    Ok(menu)
}

fn on_app_menu_event(app: &AppHandle, id: &str) {
    if let Some(rest) = id.strip_prefix("nav:") {
        let mut parts = rest.split(':');
        let page = parts.next().unwrap_or("overview").to_string();
        let intent = parts.next().map(str::to_string);
        tray::show_window(app, Some((page, intent)));
    } else if let Some(cmd) = id.strip_prefix("cmd:") {
        tray::show_window(app, None);
        let _ = app.emit("lanyard:command", cmd);
    } else if id == "app:quit" {
        app.exit(0);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_window(app, None);
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            let (program, script) = sidecar_script(app.handle());
            let sidecar = sidecar::Sidecar::spawn(app.handle().clone(), &program, &script, &[])?;
            app.manage(sidecar);

            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            app.handle().on_menu_event(|app, event| {
                let id = event.id().0.clone();
                if id.starts_with("nav:") || id.starts_with("cmd:") || id == "app:quit" {
                    on_app_menu_event(app, &id);
                } else {
                    tray::on_menu_event(app, &id);
                }
            });

            let tray = TrayIconBuilder::with_id("main")
                .tooltip("Lanyard")
                .icon(app.default_window_icon().unwrap().clone())
                .menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        tray::show_window(tray.app_handle(), None);
                    }
                })
                .build(app)?;

            let sidecar2 = app.state::<Arc<sidecar::Sidecar>>().inner().clone();
            tray::refresh_tray(app.handle(), &tray, &sidecar2);
            app.manage(tray);

            // Refresh the tray whenever the sidecar reports file/state changes.
            let handle = app.handle().clone();
            handle.listen("lanyard:changed", move |_| {
                let sidecar = handle.state::<Arc<sidecar::Sidecar>>().inner().clone();
                let tray = handle.state::<tauri::tray::TrayIcon>().inner().clone();
                tray::refresh_tray(&handle, &tray, &sidecar);
            });

            // Start hidden with --hidden (login autostart).
            let hidden = std::env::args().any(|a| a == "--hidden");
            if !hidden {
                tray::show_window(app.handle(), None);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Close-to-tray: read the setting through the sidecar.
                let close_to_tray = window
                    .app_handle()
                    .try_state::<Arc<sidecar::Sidecar>>()
                    .map(|s| {
                        let v = s.call("settings", "get", serde_json::json!([]));
                        v.get("data")
                            .and_then(|d| d.get("closeToTray"))
                            .and_then(Value::as_bool)
                            .unwrap_or(true)
                    })
                    .unwrap_or(true);
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![api_invoke])
        .run(tauri::generate_context!())
        .expect("error while running lanyard");
}
