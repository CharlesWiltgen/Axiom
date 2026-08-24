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

    def test_hidden_swiftpm_is_not_a_marker(self):
        # GH #52: SwiftPM creates ~/.swiftpm (cache/configuration/security) on any
        # machine where it has run. It ends with the ".swiftpm" marker suffix, so
        # counting it made every Apple developer's home directory read as a project.
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".swiftpm"))
            self.assertFalse(pd._dir_has_marker(d))

    def test_visible_swiftpm_package_is_still_a_marker(self):
        # Guard against over-correcting: a real Swift Playgrounds app package counts.
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, "MyApp.swiftpm"))
            self.assertTrue(pd._dir_has_marker(d))


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

    def test_ignores_marker_inside_game_engine_dir(self):
        # GH #45: Unreal/Unity build dirs are pruned, so a stray Swift file in
        # one of them does not make a non-Apple game project read as Apple.
        for prune_dir in ("Intermediate", "Binaries", "Saved", "DerivedDataCache",
                          "Library", "Temp", "Obj"):
            with tempfile.TemporaryDirectory() as d:
                touch(os.path.join(d, prune_dir, "vendored.swift"))
                self.assertFalse(pd._downward_has_marker(d), prune_dir)

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

    def test_hidden_dir_is_not_a_marker_in_scan(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".swiftpm"))
            touch(os.path.join(d, "index.js"))
            self.assertFalse(pd._downward_has_marker(d))

    def test_hidden_dirs_are_not_descended(self):
        # The descent skip is load-bearing, not tidiness: ~/.swiftpm/cache holds
        # CLONED PACKAGES, each with a visible Package.swift. Skipping the name but
        # still walking in would re-break the fix one level down.
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, ".swiftpm", "cache", "repos", "Pkg", "Package.swift"))
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


class TestIsVacuousScanRoot(unittest.TestCase):
    """GH #52: containment is meaningless at $HOME and at the top of the filesystem."""

    HOME = "/Users/someone"

    def test_filesystem_root_and_its_children_are_vacuous(self):
        for path in ("/", "/Users", "/tmp", "/Volumes", "/home"):
            self.assertTrue(pd._is_vacuous_scan_root(path, self.HOME, False), path)

    def test_home_is_vacuous(self):
        self.assertTrue(pd._is_vacuous_scan_root(self.HOME, self.HOME, False))

    def test_home_is_vacuous_even_as_a_repo_root(self):
        # Dotfiles repo: home wins over the repo-boundary exemption. This is the
        # case GH #52 actually reported.
        self.assertTrue(pd._is_vacuous_scan_root(self.HOME, self.HOME, True))

    def test_filesystem_root_is_vacuous_even_as_a_repo_root(self):
        # `git init /` must not re-open the 51-second scan of / that the depth
        # rule exists to prevent. The floor is checked before the exemption.
        self.assertTrue(pd._is_vacuous_scan_root("/", self.HOME, True))

    def test_repo_root_overrides_the_depth_rule(self):
        # Container/devcontainer workdirs are single-component paths. A repo
        # checked out there with markers in a subdir MUST still be found —
        # refusing it would be a regression against pre-GH-#52 behaviour.
        for path in ("/app", "/workspace", "/src"):
            self.assertFalse(pd._is_vacuous_scan_root(path, self.HOME, True), path)
            self.assertTrue(pd._is_vacuous_scan_root(path, self.HOME, False), path)

    def test_real_project_paths_are_not_vacuous(self):
        for path in ("/Users/someone/Projects/App", "/Volumes/Ext/Code/App", "/opt/src/App"):
            self.assertFalse(pd._is_vacuous_scan_root(path, self.HOME, False), path)

    def test_unset_home_still_gates_the_filesystem_top(self):
        self.assertTrue(pd._is_vacuous_scan_root("/", None, False))
        self.assertFalse(pd._is_vacuous_scan_root("/Users/someone/App", None, False))


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

    def test_deep_open_in_git_repo_with_root_marker(self):
        # GH #45 regression: a real Apple git repo (marker + .git only at the
        # root) opened many directories deep must still detect as Apple — the
        # upward walk must reach the root .git even past UPWARD_MAX_LEVELS.
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))
            touch(os.path.join(d, "Package.swift"))
            deep = os.path.join(d, "Tests", "A", "B", "C", "D", "E", "F")  # 7 levels deep
            os.makedirs(deep)
            self.assertTrue(pd.is_apple_project(deep))


    def test_home_with_only_swiftpm_is_not_apple(self):
        # GH #52 defect 2: the direct-marker hit at $HOME short-circuits before any
        # containment scan, so this fired on every Apple developer's machine.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            os.makedirs(os.path.join(home, ".swiftpm"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertFalse(pd.is_apple_project(home))

    def test_non_git_dir_under_home_is_not_apple(self):
        # GH #52 defect 2, wider blast radius: the upward walk checks markers at
        # every ancestor INCLUDING home, so ANY non-git dir under ~ inherited the
        # ~/.swiftpm false positive.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            os.makedirs(os.path.join(home, ".swiftpm"))
            opened = os.path.join(home, "scratch", "pyproj")
            os.makedirs(opened)
            touch(os.path.join(opened, "main.py"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertFalse(pd.is_apple_project(opened))

    def test_home_containment_does_not_inject(self):
        # GH #52 defect 1: a home directory is not a project. "Contains an Apple
        # project" is vacuous for ~ — everything is under ~.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            touch(os.path.join(home, "Projects", "App", "Package.swift"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertFalse(pd.is_apple_project(home))

    def test_dotfiles_repo_home_does_not_inject(self):
        # Home as its own git root (dotfiles setups) makes home the scan root by the
        # other path; it must reach the same verdict.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            os.makedirs(os.path.join(home, ".git"))
            touch(os.path.join(home, "Projects", "App", "Package.swift"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertFalse(pd.is_apple_project(home))

    def test_git_managed_home_does_not_hijack_a_nested_project(self):
        # REGRESSION (found in final review): probing for .git at every ancestor
        # used to WIDEN scan_root from the meaningful cwd all the way to $HOME,
        # which the vacuous-root check then refused — silently disabling Axiom for
        # every project under a dotfiles-repo home whose markers sit in a subdir.
        # A .git at home stops the ascent WITHOUT being adopted as the scan root.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            os.makedirs(os.path.join(home, ".git"))          # dotfiles repo
            app = os.path.join(home, "Projects", "App")
            touch(os.path.join(app, "ios", "App.xcodeproj", "x"))  # marker NESTED
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertTrue(pd.is_apple_project(app))

    def test_git_managed_home_scans_the_branch_when_opened_deep(self):
        # Second half of the same regression: falling back to the deep cwd misses
        # a marker that sits up-and-over (App/ios/ when opened in App/Sources/x).
        # The branch of ~ we came through is the right scan root — narrower than
        # all of ~ (the GH #52 bug), wider than the cwd.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            os.makedirs(os.path.join(home, ".git"))
            app = os.path.join(home, "Projects", "App")
            touch(os.path.join(app, "ios", "App.xcodeproj", "x"))
            opened = os.path.join(app, "Sources", "Feature", "Sub")
            os.makedirs(opened)
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertTrue(pd.is_apple_project(opened))

    def test_git_managed_home_does_not_scan_all_of_home(self):
        # The narrowing that keeps GH #52 fixed: an Apple project in a DIFFERENT
        # branch of ~ must not make an unrelated branch read as Apple.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            os.makedirs(os.path.join(home, ".git"))
            touch(os.path.join(home, "Projects", "App", "Package.swift"))
            opened = os.path.join(home, "scratch", "pyproj")
            os.makedirs(opened)
            touch(os.path.join(opened, "main.py"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertFalse(pd.is_apple_project(opened))

    def test_home_as_repo_root_is_a_known_false_negative(self):
        # Documented limit, not an oversight. Refusing containment at $HOME cannot
        # be told apart from the dotfiles-repo case this fix exists for — both are
        # a .git hit at home. The dotfiles case is what GH #52 reported, so it wins;
        # devcontainers that set HOME=/workspace with markers only in subdirectories
        # need AXIOM_SESSION_CONTEXT=always. Change this assertion only with a signal
        # that actually separates the two.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            os.makedirs(os.path.join(home, ".git"))
            touch(os.path.join(home, "ios", "App.xcodeproj", "x"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertFalse(pd.is_apple_project(home))

    def test_direct_marker_at_home_still_injects(self):
        # The home rule kills CONTAINMENT, not direct markers. Someone who really
        # does keep a project at ~ still gets Axiom.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            os.makedirs(home)
            touch(os.path.join(home, "App.xcodeproj", "x"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertTrue(pd.is_apple_project(home))

    def test_real_project_under_home_still_detected(self):
        # The regression that matters: a normal Apple project living under ~.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            proj = os.path.join(home, "Projects", "App")
            os.makedirs(os.path.join(home, ".swiftpm"))
            touch(os.path.join(proj, "Package.swift"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertTrue(pd.is_apple_project(proj))

    def test_containment_under_home_still_detected(self):
        # Scan root is NOT home here, so containment still applies normally.
        with tempfile.TemporaryDirectory() as d:
            home = os.path.join(d, "home")
            work = os.path.join(home, "work")
            os.makedirs(os.path.join(home, ".swiftpm"))
            touch(os.path.join(work, "ios", "App.xcodeproj", "x"))
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertTrue(pd.is_apple_project(work))


class TestResolveContextDecision(unittest.TestCase):
    def test_never_skips_even_in_apple_dir(self):
        with tempfile.TemporaryDirectory() as d:
            touch(os.path.join(d, "App.swift"))
            self.assertFalse(pd.resolve_context_decision(d, "never"))

    def test_always_injects_even_in_plain_dir(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(pd.resolve_context_decision(d, "always"))

    def test_always_skips_detection_for_bad_path(self):
        # always must short-circuit before any filesystem walk.
        self.assertTrue(pd.resolve_context_decision("/no/such/path", "always"))

    def test_unset_runs_detection(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))  # bound the upward walk → hermetic
            self.assertFalse(pd.resolve_context_decision(d, None))
            touch(os.path.join(d, "App.swift"))
            self.assertTrue(pd.resolve_context_decision(d, None))

    def test_garbage_value_treated_as_auto(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))  # bound the upward walk → hermetic
            self.assertFalse(pd.resolve_context_decision(d, "  Banana "))

    def test_case_and_whitespace_insensitive(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(pd.resolve_context_decision(d, "  NEVER "))


if __name__ == "__main__":
    unittest.main()
