"""Unit tests for project_detect — the SessionStart project-type gate (GH #45).

Run from the hooks dir (as pre-deploy does):
    python3 -m unittest project_detect_test -v
Hermetic: every test builds a throwaway tree under tempfile.
"""
from __future__ import annotations

import os
import tempfile
import unittest
from unittest import mock

import project_detect as pd


def touch(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write("")


class TestDirHasMarker(unittest.TestCase):
    def test_finds_swift_file(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "main.swift"))
            self.assertTrue(pd._dir_has_marker(d))

    def test_finds_xcodeproj_dir(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, "App.xcodeproj"))
            self.assertTrue(pd._dir_has_marker(d))

    def test_finds_podfile_by_exact_name(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "Podfile"))
            self.assertTrue(pd._dir_has_marker(d))

    def test_no_marker_in_plain_dir(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "index.js"))
            touch(os.path.join(d, "README.md"))
            self.assertFalse(pd._dir_has_marker(d))

    def test_unreadable_dir_returns_false(self):
        self.assertFalse(pd._dir_has_marker("/no/such/path/xyz"))


if __name__ == "__main__":
    unittest.main()
