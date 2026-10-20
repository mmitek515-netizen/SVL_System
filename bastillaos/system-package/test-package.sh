#!/bin/sh
set -eu

PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$PACKAGE_DIR/../.." && pwd)
WORK_DIR="$PACKAGE_DIR/.test-work"
SERVER_PID=
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT HUP INT TERM
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/out" "$WORK_DIR/build"

if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "test-package: node_modules/ is missing; run npm ci first." >&2
  exit 1
fi
if [ -z "${SERVER_BUNDLE:-}" ]; then
  [ -x "$REPO_ROOT/node_modules/.bin/esbuild" ] || {
    echo "test-package: esbuild is missing; run npm ci or set SERVER_BUNDLE." >&2
    exit 1
  }
  "$REPO_ROOT/node_modules/.bin/esbuild" "$REPO_ROOT/server.ts" \
    --bundle --platform=node --format=esm --packages=external --target=node20 \
    --outfile="$WORK_DIR/build/server.mjs"
  SERVER_BUNDLE="$WORK_DIR/build/server.mjs"
fi
SERVER_BUNDLE="$SERVER_BUNDLE" OUTPUT_DIR="$WORK_DIR/out" \
  "$PACKAGE_DIR/build-package.sh"
DEB="$WORK_DIR/out/bastillaos-system_1.0.0_amd64.deb"
[ -f "$DEB" ] || { echo "test-package: package was not built." >&2; exit 1; }

PACKAGE_INFO=$(dpkg-deb -f "$DEB")
printf '%s\n' "$PACKAGE_INFO" | grep -q '^Package: bastillaos-system$'
printf '%s\n' "$PACKAGE_INFO" | grep -q '^Architecture: amd64$'
printf '%s\n' "$PACKAGE_INFO" | grep -q 'nodejs (>= 20)'
printf '%s\n' "$PACKAGE_INFO" | grep -q 'git'
printf '%s\n' "$PACKAGE_INFO" | grep -q 'tar'

mkdir -p "$WORK_DIR/unpacked"
dpkg-deb -x "$DEB" "$WORK_DIR/unpacked"
ROOT="$WORK_DIR/unpacked"
for required in \
  usr/lib/bastillaos/system/server.mjs \
  usr/lib/bastillaos/system/dist/index.html \
  usr/lib/bastillaos/system/node_modules/express/package.json \
  usr/lib/bastillaos/system/node_modules/vite/package.json \
  usr/libexec/bastillaos/system-service \
  usr/lib/systemd/system/bastillaos-system.service \
  usr/share/bastillaos/system-defaults/svl_kernel.py \
  usr/share/bastillaos/system-defaults/apps/matrix-telemetry/app.json \
  usr/share/bastillaos/system-defaults/bastillaos/windows-update-agent/BastillaWindowsUpdateAgent.ps1 \
  usr/share/bastillaos/system-defaults/src/components/WindowsUpdateView.tsx \
  usr/share/bastillaos/system-defaults/src/App.tsx \
  usr/share/bastillaos/system-defaults/bastillaos/system-package/build-package.sh \
  usr/share/bastillaos/system-defaults/server.ts \
  usr/share/bastillaos/system-defaults/package.json \
  usr/share/bastillaos/system-defaults/package-lock.json \
  usr/share/bastillaos/system-defaults/index.html \
  usr/share/bastillaos/system-defaults/README.md \
  usr/share/bastillaos/system-defaults/.github/workflows/build-bastillaos.yml \
  usr/share/bastillaos/system-defaults/.gitignore; do
  [ -f "$ROOT/$required" ] || { echo "test-package: missing $required" >&2; exit 1; }
done

DEFAULTS="$ROOT/usr/share/bastillaos/system-defaults"
! find "$DEFAULTS" \( -type d \( -name .git -o -name node_modules -o -name dist -o -name build \) \
  -o -type f \( -name '.env*' -o -name '.github_credentials.json' -o -name 'svl_datastore.json' \) \) | grep -q .
grep -q '^exports/svl_datastore.json$' "$DEFAULTS/.gitignore"
! grep -q 'package-lock.json' "$DEFAULTS/.gitignore"
SERVICE="$ROOT/usr/lib/systemd/system/bastillaos-system.service"
grep -q '^User=root$' "$SERVICE"
grep -q '^Group=root$' "$SERVICE"
grep -q '^WorkingDirectory=/var/lib/bastillaos/system$' "$SERVICE"
grep -q '^Environment=NODE_ENV=production$' "$SERVICE"
grep -q '^Environment=HOST=127.0.0.1$' "$SERVICE"
grep -q '^Environment=PORT=3000$' "$SERVICE"
grep -q '^EnvironmentFile=-/etc/bastillaos/system.env$' "$SERVICE"
grep -q '^StateDirectory=bastillaos/system$' "$SERVICE"
awk '
  /^EnvironmentFile=/ { environment_file = NR }
  /^Environment=HOST=127\.0\.0\.1$/ { loopback_host = NR }
  END { exit !(environment_file && loopback_host && environment_file < loopback_host) }
' "$SERVICE"
! grep -q '^NoNewPrivileges=true$' "$SERVICE"
! grep -q '^ProtectHome=true$' "$SERVICE"
! grep -q '^ProtectSystem=strict$' "$SERVICE"
! grep -q '^ReadWritePaths=' "$SERVICE"
grep -q 'restart bastillaos-system.service' "$PACKAGE_DIR/debian/postinst"
grep -q '^After=.*network-online.target.*NetworkManager-wait-online.service' "$SERVICE"
grep -q '^Restart=on-failure$' "$SERVICE"
test -x "$ROOT/usr/libexec/bastillaos/system-service"
! find "$ROOT" \( -type d -name .git -o -type f \( -name '.env*' -o -name '.github_credentials.json' -o -name svl_datastore.json \) \) | grep -q .
! find "$ROOT" -type f -name '*.desktop' | grep -q .
! find "$ROOT" -type f -perm /002 | grep -q .
! find "$ROOT/usr/lib/bastillaos/system/node_modules" -maxdepth 1 -type d \
  \( -name react -o -name three -o -name typescript \) | grep -q .
! find "$ROOT/usr/lib/bastillaos/system/node_modules" -type d -name '*-musl' | grep -q .

RUNTIME="$ROOT/usr/lib/bastillaos/system"
STATE="$WORK_DIR/state"
mkdir -p "$STATE/exports" "$STATE/apps"
printf '%s\n' 'user datastore must persist' > "$STATE/exports/svl_datastore.json"
printf '%s\n' 'user-owned app' > "$STATE/apps/custom-app.txt"
BASTILLAOS_DEFAULTS_DIR="$DEFAULTS" \
BASTILLAOS_RUNTIME_DIR="$RUNTIME" \
BASTILLAOS_STATE_DIR="$STATE" \
BASTILLAOS_SKIP_EXEC=1 \
  "$ROOT/usr/libexec/bastillaos/system-service"
grep -q 'user datastore must persist' "$STATE/exports/svl_datastore.json"
grep -q 'user-owned app' "$STATE/apps/custom-app.txt"
[ -f "$STATE/apps/matrix-telemetry/app.json" ]
[ -f "$STATE/svl_kernel.py" ]
[ -L "$STATE/dist" ]
printf '%s\n' 'new package default' > "$DEFAULTS/exports/new-default.txt"
printf '%s\n' 'updated shipped datastore' > "$DEFAULTS/exports/svl_datastore.json"
BASTILLAOS_DEFAULTS_DIR="$DEFAULTS" \
BASTILLAOS_RUNTIME_DIR="$RUNTIME" \
BASTILLAOS_STATE_DIR="$STATE" \
BASTILLAOS_SKIP_EXEC=1 \
  "$ROOT/usr/libexec/bastillaos/system-service"
grep -q 'user datastore must persist' "$STATE/exports/svl_datastore.json"
[ -f "$STATE/exports/new-default.txt" ]
[ -w "$STATE/exports/svl_datastore.json" ]

PORT=42117
NODE_ENV=production HOST=127.0.0.1 PORT="$PORT" \
BASTILLAOS_DEFAULTS_DIR="$DEFAULTS" \
BASTILLAOS_RUNTIME_DIR="$RUNTIME" \
BASTILLAOS_STATE_DIR="$STATE" \
  "$ROOT/usr/libexec/bastillaos/system-service" > "$WORK_DIR/server.log" 2>&1 &
SERVER_PID=$!
READY=0
attempt=0
while [ "$attempt" -lt 30 ]; do
  if node -e "fetch('http://127.0.0.1:$PORT/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    READY=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat "$WORK_DIR/server.log" >&2
    echo "test-package: production server exited before becoming ready." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done
[ "$READY" -eq 1 ] || { cat "$WORK_DIR/server.log" >&2; echo "test-package: server did not become ready." >&2; exit 1; }
node -e "
fetch('http://127.0.0.1:$PORT/api/ai/status')
  .then(async response => {
    const status = await response.json();
    if (!response.ok || status.provider !== 'Google Gemini' || typeof status.configured !== 'boolean') {
      throw new Error('invalid AI status response');
    }
    if (!status.models?.Alex || !status.models?.Astyria || !status.models?.Aurelius || 'apiKey' in status) {
      throw new Error('AI status is incomplete or exposes a credential');
    }
  })
  .catch(error => { console.error(error); process.exitCode = 1; });
"
kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true
SERVER_PID=

echo "Package build and contents test passed."
