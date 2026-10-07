//! Routing decision: which `api_invoke` calls are answered natively in Rust
//! and which are proxied to the sidecar. Pure and unit-testable.

/// `app` sub-methods implemented natively (desktop concerns, no core needed).
pub const NATIVE_APP_METHODS: &[&str] = &[
    "openExternal",
    "copy",
    "pickDirectory",
    "pickFile",
    "revealPath",
    "setTheme",
    "setTitleBarColors",
    "showAppMenu",
    "isMaximized",
    "minimizeWindow",
    "toggleMaximize",
    "closeWindow",
    "cliStatus",
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
        assert!(is_native("app", "setTheme"));
    }

    #[test]
    fn routes_everything_else_to_sidecar() {
        assert!(!is_native("settings", "get"));
        assert!(!is_native("app", "info"));
        assert!(!is_native("hosts", "list"));
    }
}
