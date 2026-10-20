# BastillaOS Windows Update Agent

The BastillaOS panel can manage updates on a separate Windows computer through
the native Windows Update Agent (WUA). This helper runs on that Windows
computer; it does not run Windows Update inside Linux/Codespaces.

## Start the helper on Windows

1. Copy `BastillaWindowsUpdateAgent.ps1` to the Windows computer.
2. Open **Windows PowerShell as Administrator**.
3. Start the helper with the exact origin shown in the browser address bar for
   the BastillaOS panel:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\BastillaWindowsUpdateAgent.ps1 -AllowedOrigin "http://localhost:3000"
   ```

   For a Codespaces or other hosted panel, replace the example with its exact
   origin (scheme and host, without a path), for example
   `https://example-3000.app.github.dev`.
4. Copy the one-time token printed in that PowerShell window into the
   **Aktualizacje Windows** panel. Keep the PowerShell process open while using
   the panel. Stop it with `Ctrl+C` when finished.
5. Connect, scan, review the updates, select the ones to install, and confirm
   the installation in the panel.

The helper binds only to `127.0.0.1`, requires a random session token, allows
only the exact configured browser origin, limits requests to JSON metadata,
and re-checks selected update IDs against Windows Update immediately before
download and installation. Installation requires an elevated PowerShell
process and a separate user confirmation in the panel.

## Scope and verification

WUA searches the update source configured on that computer (Microsoft Update,
Windows Update for Business, or an organization-managed WSUS). It reports
updates currently applicable to that system; it is not a historical catalogue
covering every Windows release, and it cannot recover updates withdrawn by
Microsoft or the administrator.

WUA performs the package download and Windows trust/integrity checks. The
panel's optional SHA-256 tool only fingerprints a file selected by the user;
it does **not** validate Authenticode or authorize installation. Uploaded
files are never executed or installed. Optional OCR can read KB identifiers
from screenshots in browsers that provide the `TextDetector` API. OCR only
filters the displayed results and is never used as a trust or install check.

The Windows agent requires Windows PowerShell 5.1 or newer and an active
Windows Update service/source. Updates can restart the computer. Review the
selected updates and save work before confirming installation.
