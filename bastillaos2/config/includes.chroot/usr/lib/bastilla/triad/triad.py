#!/usr/bin/env python3
"""Natywne usługi Triady BastillaOS 2.

Alex     — zdrowie systemu (dysk, pamięć, obciążenie, usługi z błędem).
Astyria  — samonaprawa: snapshoty Btrfs (snapper) i restart usług Bastilla.
Aurelius — audyt bezpieczeństwa (zapora, AppArmor, aktualizacje, SSH).

Każdy agent zapisuje raport JSON w /var/lib/bastilla/triad/<agent>.json.
Sterowanie: triadctl run|status|snapshot.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from typing import Callable

STATE_DIR = os.environ.get("BASTILLA_TRIAD_STATE", "/var/lib/bastilla/triad")
AGENTS = ("alex", "astyria", "aurelius")
SEVERITY = {"ok": 0, "warn": 1, "crit": 2}

Runner = Callable[[list[str]], tuple[int, str]]


def run_command(cmd: list[str]) -> tuple[int, str]:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired) as err:
        return 127, str(err)
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def check(name: str, status: str, detail: str) -> dict:
    return {"name": name, "status": status, "detail": detail}


def overall(checks: list[dict]) -> str:
    worst = max((SEVERITY[c["status"]] for c in checks), default=0)
    return next(k for k, v in SEVERITY.items() if v == worst)


def report(agent: str, checks: list[dict], actions: list[str] | None = None) -> dict:
    return {
        "agent": agent,
        "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "status": overall(checks),
        "checks": checks,
        "actions": actions or [],
    }


def read_meminfo(path: str = "/proc/meminfo") -> dict[str, int]:
    values: dict[str, int] = {}
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            key, _, rest = line.partition(":")
            parts = rest.split()
            if parts and parts[0].isdigit():
                values[key] = int(parts[0])
    return values


def failed_units(runner: Runner) -> list[str]:
    code, out = runner(["systemctl", "--failed", "--plain", "--no-legend", "--no-pager"])
    if code != 0:
        return []
    return [line.split()[0] for line in out.splitlines() if line.strip()]


# --- Alex: zdrowie systemu -------------------------------------------------

def alex(
    runner: Runner = run_command,
    disk_usage: Callable[[str], object] = shutil.disk_usage,
    meminfo: Callable[[], dict[str, int]] = read_meminfo,
    loadavg: Callable[[], tuple[float, float, float]] = os.getloadavg,
    cpu_count: int | None = None,
) -> dict:
    checks = []

    usage = disk_usage("/")
    used_pct = round(100 * (usage.total - usage.free) / usage.total, 1) if usage.total else 0.0
    checks.append(check(
        "dysk /",
        "crit" if used_pct >= 95 else "warn" if used_pct >= 85 else "ok",
        f"zajęte {used_pct}%",
    ))

    mem = meminfo()
    total, available = mem.get("MemTotal", 0), mem.get("MemAvailable", 0)
    free_pct = round(100 * available / total, 1) if total else 100.0
    checks.append(check(
        "pamięć",
        "crit" if free_pct < 5 else "warn" if free_pct < 15 else "ok",
        f"dostępne {free_pct}%",
    ))

    cpus = cpu_count or os.cpu_count() or 1
    load15 = loadavg()[2]
    checks.append(check(
        "obciążenie",
        "warn" if load15 > 2 * cpus else "ok",
        f"średnia 15 min {load15:.2f} na {cpus} CPU",
    ))

    failed = failed_units(runner)
    checks.append(check(
        "usługi",
        "warn" if failed else "ok",
        ("z błędem: " + ", ".join(failed)) if failed else "wszystkie działają",
    ))
    return report("alex", checks)


# --- Astyria: snapshoty i samonaprawa -------------------------------------

def root_is_btrfs(runner: Runner) -> bool:
    code, out = runner(["findmnt", "-no", "FSTYPE", "/"])
    return code == 0 and out.strip() == "btrfs"


def ensure_snapper_config(runner: Runner) -> bool:
    code, out = runner(["snapper", "--csvout", "list-configs"])
    if code == 0 and any(line.split(",")[0] == "root" for line in out.splitlines()[1:]):
        return True
    code, _ = runner(["snapper", "-c", "root", "create-config", "/"])
    return code == 0


def snapshot(runner: Runner, description: str) -> dict:
    if not root_is_btrfs(runner):
        return check("snapshot", "ok", "system plików / to nie Btrfs — snapshoty pominięte")
    if not ensure_snapper_config(runner):
        return check("snapshot", "warn", "nie udało się utworzyć konfiguracji snapper")
    code, out = runner([
        "snapper", "-c", "root", "create",
        "--cleanup-algorithm", "number",
        "--description", f"Astyria: {description}",
    ])
    return check("snapshot", "ok" if code == 0 else "warn", "utworzono" if code == 0 else out[:200])


def astyria(runner: Runner = run_command) -> dict:
    checks = [snapshot(runner, "codzienny")]
    actions = []
    # Samonaprawa obejmuje tylko własne usługi systemu — reszta trafia do raportu Alexa.
    for unit in failed_units(runner):
        if not unit.startswith("bastilla-"):
            continue
        runner(["systemctl", "reset-failed", unit])
        code, _ = runner(["systemctl", "restart", unit])
        actions.append(f"restart {unit}: {'OK' if code == 0 else 'błąd'}")
    checks.append(check(
        "samonaprawa",
        "warn" if any("błąd" in a for a in actions) else "ok",
        "; ".join(actions) or "brak usług Bastilla do naprawy",
    ))
    return report("astyria", checks, actions)


# --- Aurelius: audyt bezpieczeństwa ---------------------------------------

def sshd_permits_root(config_path: str = "/etc/ssh/sshd_config") -> bool:
    if not os.path.exists(config_path):
        return False
    with open(config_path, encoding="utf-8", errors="replace") as handle:
        for line in handle:
            parts = line.split()
            if len(parts) >= 2 and parts[0].lower() == "permitrootlogin":
                return parts[1].lower() == "yes"
    return False


def aurelius(runner: Runner = run_command, sshd_config: str = "/etc/ssh/sshd_config") -> dict:
    checks = []

    code, out = runner(["ufw", "status"])
    active = code == 0 and "Status: active" in out
    checks.append(check("zapora ufw", "ok" if active else "crit", "aktywna" if active else "wyłączona"))

    code, _ = runner(["aa-enabled", "--quiet"])
    checks.append(check("AppArmor", "ok" if code == 0 else "warn", "włączony" if code == 0 else "wyłączony"))

    code, out = runner(["systemctl", "is-enabled", "unattended-upgrades.service"])
    enabled = code == 0 and out.strip() == "enabled"
    checks.append(check(
        "automatyczne poprawki",
        "ok" if enabled else "warn",
        "włączone" if enabled else "wyłączone",
    ))

    root_ssh = sshd_permits_root(sshd_config)
    checks.append(check(
        "SSH root",
        "crit" if root_ssh else "ok",
        "logowanie roota przez SSH dozwolone" if root_ssh else "zablokowane lub brak SSH",
    ))
    return report("aurelius", checks)


# --- CLI -------------------------------------------------------------------

def save(result: dict, state_dir: str = STATE_DIR) -> str:
    os.makedirs(state_dir, exist_ok=True)
    path = os.path.join(state_dir, f"{result['agent']}.json")
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
    os.replace(tmp, path)
    return path


def load_all(state_dir: str = STATE_DIR) -> list[dict]:
    results = []
    for agent in AGENTS:
        path = os.path.join(state_dir, f"{agent}.json")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as handle:
                results.append(json.load(handle))
    return results


def format_status(results: list[dict]) -> str:
    if not results:
        return "Triada nie ma jeszcze raportów (usługi startują 2 minuty po uruchomieniu)."
    lines = []
    for result in results:
        lines.append(f"{result['agent'].capitalize():9} {result['status'].upper():5} {result['at']}")
        for item in result["checks"]:
            lines.append(f"  [{item['status']}] {item['name']}: {item['detail']}")
    return "\n".join(lines)


AGENT_FUNCS = {"alex": alex, "astyria": astyria, "aurelius": aurelius}


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "run" and argv[1] in AGENT_FUNCS:
        result = AGENT_FUNCS[argv[1]]()
        save(result)
        print(format_status([result]))
        return 0 if result["status"] != "crit" else 2
    if argv[:1] == ["status"]:
        print(format_status(load_all()))
        return 0
    if argv[:1] == ["snapshot"]:
        item = snapshot(run_command, " ".join(argv[1:]) or "ręczny")
        print(f"[{item['status']}] {item['detail']}")
        return 0 if item["status"] == "ok" else 1
    print("Użycie: triadctl status | run alex|astyria|aurelius | snapshot [opis]", file=sys.stderr)
    return 64


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
