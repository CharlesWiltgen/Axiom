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


class TestDownwardHasMarker(unittest.TestCase):
    def test_finds_marker_at_root(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "App.swift"))
            self.assertTrue(pd._downward_has_marker(d))

    def test_finds_marker_nested_within_depth(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "ios", "App.xcodeproj", "x"))  # depth 1 dir
            self.assertTrue(pd._downward_has_marker(d))

    def test_ignores_marker_inside_pruned_dir(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "node_modules", "dep", "vendored.swift"))
            self.assertFalse(pd._downward_has_marker(d))

    def test_ignores_marker_below_depth_cap(self):
        with tempfile.TemporaryDirectory() as d:
            deep = os.path.join(d, "a", "b", "c", "d", "e")  # depth 5 > cap 4
            touch(os.path.join(deep, "Deep.swift"))
            self.assertFalse(pd._downward_has_marker(d))

    def test_plain_tree_returns_false(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "src", "index.ts"))
            touch(os.path.join(d, "pkg", "main.go"))
            self.assertFalse(pd._downward_has_marker(d))

    def test_entry_cap_fails_open(self):
        # An inconclusive scan (cap hit before any marker) must inject, not skip.
        original = pd.MAX_ENTRIES
        pd.MAX_ENTRIES = 3
        self.addCleanup(setattr, pd, "MAX_ENTRIES", original)
        with tempfile.TemporaryDirectory() as d:
            for i in range(10):
                touch(os.path.join(d, f"file{i}.txt"))  # 10 non-marker entries > cap 3
            self.assertTrue(pd._downward_has_marker(d))


class TestIsAppleProject(unittest.TestCase):
    def test_marker_in_cwd(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "Package.swift"))
            self.assertTrue(pd.is_apple_project(d))

    def test_marker_in_ancestor_opened_in_subdir(self):
        # Opened deep inside an Apple project; markers are UP, not down.
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "App.xcodeproj", "x"))
            sub = os.path.join(d, "Sources", "Feature")
            os.makedirs(sub)
            self.assertTrue(pd.is_apple_project(sub))

    def test_sibling_app_via_git_root(self):
        # Monorepo: app in ios/, opened in web/, .git at repo root → repo-wide.
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))
            touch(os.path.join(d, "ios", "App.xcodeproj", "x"))
            web = os.path.join(d, "web")
            os.makedirs(web)
            self.assertTrue(pd.is_apple_project(web))

    def test_git_root_stops_upward_walk(self):
        # Marker ABOVE the git root must NOT be reached (repo boundary).
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "Above.swift"))         # above the repo
            repo = os.path.join(d, "repo")
            os.makedirs(os.path.join(repo, ".git"))
            opened = os.path.join(repo, "web")
            os.makedirs(opened)
            self.assertFalse(pd.is_apple_project(opened))

    def test_plain_non_apple_repo_is_false(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))
            touch(os.path.join(d, "src", "index.ts"))
            self.assertFalse(pd.is_apple_project(d))

    def test_unreadable_start_fails_open(self):
        self.assertTrue(pd.is_apple_project("/no/such/path/xyz"))

    def test_home_stops_upward_walk(self):
        # A marker ABOVE $HOME must not be reached: the walk stops at $HOME.
        # HOME is mocked to a synthetic mid-path so the test is machine-independent.
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "Above.swift"))            # above the synthetic home
            home = os.path.join(d, "home")
            opened = os.path.join(home, "proj", "web")
            os.makedirs(opened)
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertFalse(pd.is_apple_project(opened))


if __name__ == "__main__":
    unittest.main()
