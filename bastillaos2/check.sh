#!/usr/bin/env bash
# Testy BastillaOS 2 — uruchamiane po każdym cyklu Triady i przed budowaniem ISO.
# Każdy nowy element systemu dostaje tu swój test.
set -euo pipefail
cd "$(dirname "$0")"
fail() { echo "BŁĄD: $*" >&2; exit 1; }

test -s MISSION.md || fail "brak MISSION.md"

# 1. Składnia skryptów powłoki (bash i sh).
while IFS= read -r -d '' script; do
  case "$(head -n1 "$script")" in
    *bash*) bash -n "$script" ;;
    *) sh -n "$script" ;;
  esac
done < <(find . \( -name '*.sh' -o -name '*.hook.chroot' -o -path './config/auto/*' \) -type f -print0)
sh -n config/includes.chroot/usr/bin/triadctl

# 2. Wykonywalność skryptów, które live-build i system uruchamiają bezpośrednio.
for exe in build.sh check.sh config/auto/config config/includes.chroot/usr/bin/triadctl \
           config/includes.chroot/usr/lib/bastilla/triad/triad.py config/hooks/live/*.hook.chroot; do
  [ -x "$exe" ] || fail "$exe nie jest wykonywalny"
done

# 3. Konfiguracja obrazu: Trixie, hybrydowe ISO, Calamares zamiast debian-installer.
grep -q -- '--distribution trixie' config/auto/config || fail "obraz musi bazować na Debian 13 Trixie"
grep -q -- '--binary-image iso-hybrid' config/auto/config || fail "obraz musi być hybrydowym ISO"
grep -q -- '--debian-installer none' config/auto/config || fail "BastillaOS 2 używa Calamares, nie debian-installer"
grep -qx 'calamares' config/package-lists/desktop.list.chroot || fail "brak instalatora Calamares"

# 4. Listy pakietów: niepuste i bez duplikatów między listami.
dups="$(cat config/package-lists/*.list.chroot | sed 's/#.*//' | awk 'NF' | sort | uniq -d)"
[ -z "$dups" ] || fail "zduplikowane pakiety: $dups"
for list in config/package-lists/*.list.chroot; do
  grep -qv '^\s*\(#\|$\)' "$list" || fail "pusta lista $list"
done

# 5. Usługi Triady: każda usługa ma timer, timer jest włączany w hooku, ExecStart wskazuje istniejący plik.
units=config/includes.chroot/usr/lib/systemd/system
for agent in alex astyria aurelius; do
  [ -f "$units/bastilla-$agent.service" ] || fail "brak bastilla-$agent.service"
  [ -f "$units/bastilla-$agent.timer" ] || fail "brak bastilla-$agent.timer"
  grep -q "^ExecStart=.*triad.py run $agent$" "$units/bastilla-$agent.service" || fail "zły ExecStart $agent"
  grep -q "bastilla-$agent.timer" config/hooks/live/0100-bastilla-system.hook.chroot || fail "timer $agent nie jest włączany"
  grep -q '^OnCalendar=' "$units/bastilla-$agent.timer" || fail "timer $agent bez harmonogramu"
done

# 6. Kod i testy Triady.
python3 -m py_compile config/includes.chroot/usr/lib/bastilla/triad/triad.py
python3 -m unittest discover -s tests -q 2>&1 | tail -n 3

# 7. Utwardzenie jądra obecne.
grep -q '^kernel.kptr_restrict = 2' config/includes.chroot/etc/sysctl.d/90-bastilla.conf || fail "brak utwardzenia sysctl"

echo "BastillaOS 2: check OK"
