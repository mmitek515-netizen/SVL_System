#!/usr/bin/env bash
# Testy BastillaOS 2 — uruchamiane po każdym cyklu autonomii Triady.
# Agenci dopisują tu test dla każdego nowego elementu systemu.
set -euo pipefail
cd "$(dirname "$0")"

test -s MISSION.md || { echo "Brak MISSION.md"; exit 1; }

# Składnia wszystkich skryptów powłoki nowego systemu.
while IFS= read -r -d '' script; do
  bash -n "$script"
done < <(find . -name '*.sh' -print0)

echo "BastillaOS 2: check OK"
