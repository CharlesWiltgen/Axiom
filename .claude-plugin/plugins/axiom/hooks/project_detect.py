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
