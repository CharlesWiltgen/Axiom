#!/usr/bin/env python3
"""Project-type detection for the SessionStart gate (GH #45).

Decides whether Axiom should inject its context into a session: yes in Apple
projects, no in non-Apple ones. Pure (filesystem reads only, no print), so
session-start.py imports it and the unit tests exercise it directly.

Bulletproof bias: the cardinal sin is a FALSE NEGATIVE (a real Apple project
read as non-Apple → Axiom silently off). So every code path fails OPEN (inject)
on doubt or error, and AXIOM_SESSION_CONTEXT is the manual override.

Must stay Python 3.9-safe (macOS stock python3): __future__ annotations on,
no match statements, no runtime PEP 604 unions.
"""
from __future__ import annotations

import os

# Presence of any of these in a directory marks it an Apple project. ".swift"
# covers Package.swift and Project.swift, so only Podfile needs an exact name.
APPLE_MARKER_SUFFIXES = (".xcodeproj", ".xcworkspace", ".swiftpm", ".playground", ".swift")
APPLE_MARKER_NAMES = frozenset({"Podfile"})

# Skipped in the downward BFS — large, never an Apple marker source.
PRUNE_DIRS = frozenset({
    "node_modules", ".git", "build", ".build", "Pods", "DerivedData",
    "dist", "target", ".venv", "venv", "vendor", "Carthage", ".gradle",
    "__pycache__", "out",
})

UPWARD_MAX_LEVELS = 6   # ancestor cap when there is no .git root
DOWNWARD_MAX_DEPTH = 4  # BFS depth below the scan root
MAX_ENTRIES = 10000     # downward scan safety cap → fail-open on hit


def _dir_has_marker(path: str) -> bool:
    """True if `path` directly contains an Apple marker. Unreadable → False."""
    try:
        with os.scandir(path) as it:
            for entry in it:
                name = entry.name
                if name in APPLE_MARKER_NAMES or name.endswith(APPLE_MARKER_SUFFIXES):
                    return True
    except OSError:
        return False
    return False


def _downward_has_marker(root: str) -> bool:
    """BFS from `root` for an Apple marker.

    Returns True if a marker is found OR the entry cap is hit before a verdict
    (fail-open — an inconclusive scan must not read as "not Apple"). Returns
    False only when the whole bounded, pruned tree is scanned with no marker.
    Does not follow directory symlinks (cycle safety).
    """
    seen = 0
    stack = [(root, 0)]
    while stack:
        path, depth = stack.pop()
        try:
            with os.scandir(path) as it:
                for entry in it:
                    seen += 1
                    if seen > MAX_ENTRIES:
                        return True  # inconclusive → fail-open
                    name = entry.name
                    if name in APPLE_MARKER_NAMES or name.endswith(APPLE_MARKER_SUFFIXES):
                        return True
                    if depth < DOWNWARD_MAX_DEPTH and name not in PRUNE_DIRS:
                        try:
                            is_dir = entry.is_dir(follow_symlinks=False)
                        except OSError:
                            is_dir = False
                        if is_dir:
                            stack.append((entry.path, depth + 1))
        except OSError:
            continue
    return False


def is_apple_project(start: str) -> bool:
    """True if `start` is inside, or contains, an Apple project.

    Upward pass: scan each level for markers (catching ancestor markers when
    opened in a subdir) and find the git root. Downward pass: bounded BFS from
    the git root (repo-wide; finds an app in a sibling subdir), or from `start`
    when there is no git root. Any exception, or a nonexistent/unreadable start
    (e.g. a deleted cwd), → fail-open (True).
    """
    try:
        cur = os.path.abspath(start)
        if not os.path.isdir(cur):
            return True  # nonexistent/unreadable start (deleted cwd, etc.) → fail-open
        home = os.environ.get("HOME")
        home = os.path.abspath(home) if home else None
        scan_root = cur
        levels = 0
        while True:
            if _dir_has_marker(cur):           # scan THIS level before stopping
                return True
            if os.path.exists(os.path.join(cur, ".git")):  # file (worktree) or dir
                scan_root = cur                # repo root → scan repo-wide
                break
            parent = os.path.dirname(cur)
            if parent == cur:
                break                          # filesystem root
            if home is not None and cur == home:
                break                          # do not ascend past $HOME
            levels += 1
            if levels >= UPWARD_MAX_LEVELS:
                break                          # no-git cap; scan_root stays = start
            cur = parent
        return _downward_has_marker(scan_root)
    except Exception:
        return True  # fail-open: never misclassify an Apple project as non-Apple


def resolve_context_decision(cwd: str, override: str | None) -> bool:
    """Return True to inject Axiom context, False to skip.

    AXIOM_SESSION_CONTEXT override: 'never' → skip; 'always' → inject (no scan);
    anything else / unset → auto-detect. Lenient: unknown values mean auto.
    """
    o = (override or "").strip().lower()
    if o == "never":
        return False
    if o == "always":
        return True
    return is_apple_project(cwd)
