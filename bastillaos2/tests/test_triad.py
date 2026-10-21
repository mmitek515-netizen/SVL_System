"""Testy natywnych usług Triady BastillaOS 2 (bez dostępu do prawdziwego systemu)."""

import importlib.util
import json
import os
import tempfile
import unittest
from collections import namedtuple

HERE = os.path.dirname(os.path.abspath(__file__))
TRIAD_PATH = os.path.join(HERE, "..", "config", "includes.chroot", "usr", "lib", "bastilla", "triad", "triad.py")
spec = importlib.util.spec_from_file_location("triad", TRIAD_PATH)
triad = importlib.util.module_from_spec(spec)
spec.loader.exec_module(triad)

Usage = namedtuple("Usage", "total used free")


class FakeRunner:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def __call__(self, cmd):
        self.calls.append(cmd)
        key = " ".join(cmd)
        for prefix, response in self.responses.items():
            if key.startswith(prefix):
                return response
        return 0, ""


class AlexTest(unittest.TestCase):
    def run_alex(self, free, available, failed=""):
        runner = FakeRunner({"systemctl --failed": (0, failed)})
        return triad.alex(
            runner=runner,
            disk_usage=lambda _: Usage(100, 100 - free, free),
            meminfo=lambda: {"MemTotal": 1000, "MemAvailable": available},
            loadavg=lambda: (0.5, 0.5, 0.5),
            cpu_count=4,
        )

    def test_healthy_system(self):
        result = self.run_alex(free=50, available=500)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["agent"], "alex")

    def test_full_disk_is_critical(self):
        self.assertEqual(self.run_alex(free=3, available=500)["status"], "crit")

    def test_failed_units_are_reported(self):
        result = self.run_alex(free=50, available=500, failed="nginx.service loaded failed failed X\n")
        self.assertEqual(result["status"], "warn")
        self.assertIn("nginx.service", result["checks"][-1]["detail"])


class AstyriaTest(unittest.TestCase):
    def test_skips_snapshots_without_btrfs(self):
        runner = FakeRunner({"findmnt": (0, "ext4")})
        result = triad.astyria(runner)
        self.assertIn("nie Btrfs", result["checks"][0]["detail"])
        self.assertFalse(any(c[0] == "snapper" for c in runner.calls))

    def test_creates_config_and_snapshot_on_btrfs(self):
        runner = FakeRunner({
            "findmnt": (0, "btrfs"),
            "snapper --csvout list-configs": (0, "Config,Subvolume\n"),
        })
        result = triad.astyria(runner)
        self.assertEqual(result["checks"][0]["detail"], "utworzono")
        self.assertIn(["snapper", "-c", "root", "create-config", "/"], runner.calls)

    def test_restarts_only_bastilla_units(self):
        runner = FakeRunner({
            "findmnt": (0, "ext4"),
            "systemctl --failed": (0, "bastilla-alex.service loaded failed\nnginx.service loaded failed\n"),
        })
        result = triad.astyria(runner)
        self.assertEqual(result["actions"], ["restart bastilla-alex.service: OK"])
        self.assertNotIn(["systemctl", "restart", "nginx.service"], runner.calls)


class AureliusTest(unittest.TestCase):
    def test_secure_system(self):
        runner = FakeRunner({
            "ufw status": (0, "Status: active"),
            "systemctl is-enabled": (0, "enabled"),
        })
        with tempfile.NamedTemporaryFile("w", delete=False) as cfg:
            cfg.write("PermitRootLogin no\n")
        try:
            result = triad.aurelius(runner, sshd_config=cfg.name)
        finally:
            os.unlink(cfg.name)
        self.assertEqual(result["status"], "ok")

    def test_disabled_firewall_is_critical(self):
        runner = FakeRunner({"ufw status": (0, "Status: inactive")})
        result = triad.aurelius(runner, sshd_config="/nonexistent")
        self.assertEqual(result["status"], "crit")


class CliTest(unittest.TestCase):
    def test_save_and_status(self):
        with tempfile.TemporaryDirectory() as state:
            result = triad.report("aurelius", [triad.check("x", "warn", "y")])
            path = triad.save(result, state)
            with open(path, encoding="utf-8") as handle:
                self.assertEqual(json.load(handle)["status"], "warn")
            text = triad.format_status(triad.load_all(state))
            self.assertIn("Aurelius", text)
            self.assertIn("[warn] x: y", text)

    def test_unknown_command(self):
        self.assertEqual(triad.main(["bogus"]), 64)


if __name__ == "__main__":
    unittest.main()
