//! System tray. The menu structure comes from the sidecar (`menu.traySpec`)
//! as JSON; this module only materializes it into Tauri menu items and routes
//! clicks back (`menu.act`) unless the id is `app:`-prefixed (handled here).

use serde::Deserialize;
use std::sync::Arc;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIcon;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::sidecar::Sidecar;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuItemSpec {
    pub id: Option<String>,
    pub label: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub checked: Option<bool>,
    pub enabled: Option<bool>,
    pub submenu: Option<Vec<TrayMenuItemSpec>>,
}

#[derive(Debug, Deserialize)]
pub struct TraySpec {
    pub tooltip: String,
    pub items: Vec<TrayMenuItemSpec>,
}

fn build_submenu<R: Runtime>(app: &AppHandle<R>, title: &str, items: &[TrayMenuItemSpec]) -> tauri::Result<Submenu<R>> {
    let submenu = Submenu::with_id(app, format!("sub:{title}"), title, true)?;
    for item in items {
        append_item(app, &submenu, item)?;
    }
    Ok(submenu)
}

fn append_item<R: Runtime, M: Manager<R>>(app: &AppHandle<R>, menu: &M, item: &TrayMenuItemSpec) -> tauri::Result<()>
where
    M: tauri::menu::AddMenuItem<R>,
{
    if item.kind.as_deref() == Some("separator") {
        menu.add_item(&PredefinedMenuItem::separator(app)?)?;
        return Ok(());
    }
    let label = item.label.clone().unwrap_or_default();
    let enabled = item.enabled.unwrap_or(true);
    if let Some(sub) = &item.submenu {
        let submenu = build_submenu(app, &label, sub)?;
        menu.add_item(&submenu)?;
        return Ok(());
    }
    let id = item.id.clone().unwrap_or_else(|| format!("noop:{label}"));
    match item.kind.as_deref() {
        Some("radio") | Some("checkbox") => {
            menu.add_item(&CheckMenuItem::with_id(app, &id, &label, enabled, item.checked.unwrap_or(false), None)?)?;
        }
        _ => {
            menu.add_item(&MenuItem::with_id(app, &id, &label, enabled, None::<&str>)?)?;
        }
    }
    Ok(())
}

/// Rebuild the tray menu from the sidecar's current spec.
pub fn refresh_tray(app: &AppHandle, tray: &TrayIcon, sidecar: &Arc<Sidecar>) {
    let spec_value = sidecar.call("menu", "traySpec", serde_json::json!([]));
    let spec: TraySpec = match serde_json::from_value(spec_value.get("data").cloned().unwrap_or_default()) {
        Ok(s) => s,
        Err(err) => {
            eprintln!("tray: bad spec: {err}");
            return;
        }
    };
    let _ = tray.set_tooltip(Some(&spec.tooltip));
    match build_menu(app, &spec.items) {
        Ok(menu) => {
            let _ = tray.set_menu(Some(menu));
        }
        Err(err) => eprintln!("tray: could not build menu: {err}"),
    }
}

fn build_menu(app: &AppHandle, items: &[TrayMenuItemSpec]) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    for item in items {
        append_item(app, &menu, item)?;
    }
    Ok(menu)
}

/// Handle a tray menu click. `app:` ids are shell concerns; the rest go to
/// the sidecar.
pub fn on_menu_event(app: &AppHandle, id: &str) {
    match id {
        "app:open" => show_window(app, None),
        "app:quit" => {
            app.exit(0);
        }
        "app:toggle-login" => {
            let _ = toggle_autostart(app);
        }
        _ => {
            if let Some(sidecar) = app.try_state::<Arc<Sidecar>>() {
                let sidecar = Arc::clone(sidecar.inner());
                let app2 = app.clone();
                std::thread::spawn(move || {
                    sidecar.call("menu", "act", serde_json::json!([id]));
                    refresh_from_state(&app2);
                });
            }
        }
    }
}

fn refresh_from_state(app: &AppHandle) {
    let sidecar = app.try_state::<Arc<Sidecar>>().map(|s| Arc::clone(s.inner()));
    let tray = app.try_state::<TrayIcon>().map(|t| t.inner().clone());
    if let (Some(sidecar), Some(tray)) = (sidecar, tray) {
        refresh_tray(app, &tray, &sidecar);
    }
}

/// Show (and optionally navigate) the main window.
pub fn show_window(app: &AppHandle, nav: Option<(String, Option<String>)>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        if let Some((page, intent)) = nav {
            let _ = app.emit("lanyard:navigate", serde_json::json!({ "page": page, "intent": intent }));
        }
    }
}

fn toggle_autostart(app: &AppHandle) -> tauri::Result<()> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    if autostart.is_enabled().unwrap_or(false) {
        autostart.disable()?;
    } else {
        autostart.enable()?;
    }
    Ok(())
}
