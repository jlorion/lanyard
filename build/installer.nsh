; Lanyard NSIS hooks (wired up via nsis.include in electron-builder.yml).
;
; The installer puts the `lanyard` / `lny` commands on the user's PATH and the
; uninstaller removes them. The PATH edit itself is done by the app
; (`--install-cli` / `--uninstall-cli`, see src/main/cli-install.ts), which
; preserves REG_EXPAND_SZ entries, never truncates long PATHs and broadcasts
; the change - things that are fragile to do in NSIS string handling.

!macro customInstall
  nsExec::ExecToLog '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --install-cli'
!macroend

!macro customUnInstall
  ; Runs before the app files are deleted. Skipped during updates: the new
  ; installer re-registers the commands right away.
  ${ifNot} ${isUpdated}
    nsExec::ExecToLog '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --uninstall-cli'
  ${endIf}
!macroend
