"""Tests for version_context.py, the one source of the iOS/Xcode version ground
truth that every harness injects, and for xcode_path.detect_toolchain, which
supplies its installed-toolchain line.

axiom-pi and axiom-mcp render the same text in TypeScript;
scripts/version-context.test.ts holds them byte-identical to this module.

Run from the hooks dir:
    python3 -m unittest version_context_test -v
"""
from __future__ import annotations

import os
import plistlib
import re
import tempfile
import unittest

import version_context
import xcode_path
from xcode_path import Toolchain

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_SKILL = os.path.join(os.path.dirname(HOOKS_DIR), "skills", "axiom-tools", "SKILL.md")

FULL = Toolchain("/Applications/Xcode-beta.app", "27.2", "27.2")


class TestVersionGroundTruth(unittest.TestCase):
    def test_heading_carries_the_date(self):
        self.assertTrue(
            version_context.version_ground_truth("Thursday, 2026-10-08", None).startswith(
                "## iOS / Xcode VERSION GROUND TRUTH (Current date: Thursday, 2026-10-08)\n"
            )
        )

    def test_names_no_current_major(self):
        text = version_context.version_ground_truth("d", FULL)
        self.assertEqual(re.findall(r"current major", text), [])

    def test_wording_is_harness_neutral(self):
        # Every harness receives this exact text, so it may not name a tool or
        # command only one harness has.
        text = version_context.version_ground_truth("d", FULL)
        found = [s for s in ("/axiom:", "/axiom-", "Skill tool", "invoke") if s in text]
        self.assertEqual(found, [])

    def test_states_the_installed_xcode_and_sdk(self):
        self.assertIn(
            "\n\nInstalled on this machine: Xcode 27.2 with the iOS 27.2 SDK "
            "(`/Applications/Xcode-beta.app`). That proves\n"
            "those versions exist; it does not prove nothing newer has shipped.\n",
            version_context.version_ground_truth("d", FULL),
        )

    def test_sdk_clause_is_omitted_without_an_sdk_version(self):
        text = version_context.version_ground_truth("d", Toolchain("/X.app", "27.2", None))
        self.assertIn("Installed on this machine: Xcode 27.2 (`/X.app`).", text)

    def test_no_installed_line_without_an_xcode_version(self):
        for toolchain in (None, Toolchain("/X.app", None, "27.2")):
            with self.subTest(toolchain=toolchain):
                self.assertNotIn(
                    "Installed on this machine",
                    version_context.version_ground_truth("d", toolchain),
                )


class TestAttribution(unittest.TestCase):
    def test_matches_the_sentence_in_the_axiom_tools_session_span(self):
        # Claude Code receives the sentence through the axiom-tools span; the other
        # harnesses receive this constant. The two must be the same sentence.
        with open(TOOLS_SKILL, encoding="utf-8") as f:
            skill = f.read()
        span = skill[skill.index("AXIOM_SESSION_START_BEGIN"):skill.index("AXIOM_SESSION_START_END")]
        self.assertIn(version_context.ATTRIBUTION, span)


class TestFormatDate(unittest.TestCase):
    def test_weekday_and_iso_date(self):
        from datetime import datetime

        self.assertEqual(
            version_context.format_date(datetime(2026, 10, 8, 23, 59)), "Thursday, 2026-10-08"
        )


class TestDetectToolchain(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.app = os.path.join(tmp.name, "Xcode.app")
        self.contents = os.path.join(self.app, "Contents")
        self.sdk = os.path.join(
            self.contents, "Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk"
        )
        os.makedirs(self.sdk)
        self.select = lambda env: os.path.join(self.contents, "Developer")

    def write_plist(self, path: str, value: dict) -> None:
        with open(path, "wb") as f:
            plistlib.dump(value, f)

    def test_reads_the_active_xcodes_versions(self):
        self.write_plist(os.path.join(self.contents, "Info.plist"), {"CFBundleShortVersionString": "99.1"})
        self.write_plist(os.path.join(self.sdk, "SDKSettings.plist"), {"Version": "99.2"})
        self.assertEqual(
            xcode_path.detect_toolchain({}, xcode_select=self.select),
            Toolchain(self.app, "99.1", "99.2"),
        )

    def test_non_string_or_missing_values_read_as_absent(self):
        self.write_plist(os.path.join(self.contents, "Info.plist"), {"CFBundleShortVersionString": 27})
        self.assertEqual(
            xcode_path.detect_toolchain({}, xcode_select=self.select),
            Toolchain(self.app, None, None),
        )


if __name__ == "__main__":
    unittest.main()
