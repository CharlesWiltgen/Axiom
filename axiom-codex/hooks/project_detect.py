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

# Skipped in the downward scan — large, never an Apple marker source. Pruning
# these keeps the scan fast AND keeps a big tree from tripping the MAX_ENTRIES
# fail-open (which would over-inject in exactly the non-Apple projects this gate
# exists to keep quiet — e.g. a Unreal/Unity game project, GH #45's reporter).
PRUNE_DIRS = frozenset({
    "node_modules", ".git", "build", ".build", "Pods", "DerivedData",
    "dist", "target", ".venv", "venv", "vendor", "Carthage", ".gradle",
    "__pycache__", "out",
    # Game-engine build/cache dirs — large, never hold Apple source.
    "Intermediate", "Binaries", "Saved", "DerivedDataCache",  # Unreal
    "Library", "Temp", "Obj",                                 # Unity
})

UPWARD_MAX_LEVELS = 6   # ancestor cap when there is no .git root
DOWNWARD_MAX_DEPTH = 4  # downward-scan depth below the scan root
MAX_ENTRIES = 10000     # downward scan safety cap → fail-open on hit


def _is_marker(name: str) -> bool:
    """True if `name` identifies an Apple project.

    HIDDEN entries never count. A dot-prefixed marker is tool state, not a
    project: SwiftPM creates ~/.swiftpm (cache/, configuration/, security/) on
    any machine where it has run, and ".swiftpm" ends with a marker suffix. That
    made $HOME — and every non-git directory under it, since the upward walk
    checks markers at each ancestor — read as an Apple project on every Apple
    developer's machine (GH #52). Nothing real is lost: a package's own
    <pkg>/.swiftpm always sits beside a visible Package.swift.
    """
    if name.startswith("."):
        return False
    return name in APPLE_MARKER_NAMES or name.endswith(APPLE_MARKER_SUFFIXES)


def _dir_has_marker(path: str) -> bool:
    """True if `path` directly contains an Apple marker. Unreadable → False."""
    try:
        with os.scandir(path) as it:
            for entry in it:
                if _is_marker(entry.name):
                    return True
    except OSError:
        return False
    return False


def _downward_has_marker(root: str) -> bool:
    """Bounded depth-first scan from `root` for an Apple marker.

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
                    if _is_marker(name):
                        return True
                    # Hidden dirs are skipped, not just unnamed as markers: the
                    # ~/.swiftpm cache holds CLONED PACKAGES, each with a visible
                    # Package.swift, so descending would re-break the fix one
                    # level down — and burn entries toward the fail-open cap.
                    if (depth < DOWNWARD_MAX_DEPTH
                            and not name.startswith(".")
                            and name not in PRUNE_DIRS):
                        try:
                            is_dir = entry.is_dir(follow_symlinks=False)
                        except OSError:
                            is_dir = False
                        if is_dir:
                            stack.append((entry.path, depth + 1))
        except OSError:
            continue
    return False


def _is_vacuous_scan_root(path: str, home: str | None, is_repo_root: bool) -> bool:
    """True when "does this contain an Apple project?" is a meaningless question.

    A home directory and the top of the filesystem contain EVERYTHING, so a
    containment scan rooted there finds SOME project — or trips MAX_ENTRIES and
    fails open — regardless of what the session is about. $HOME is what GH #52
    reported; `/`, `/Users`, `/tmp`, and `/Volumes` are the same defect one level
    up, and `/` additionally cost 50-115s of blocking scan (measured twice,
    different conditions) in a hook that runs on every prompt, not just at
    session start.

    Depth, not a denylist: anything at or within one level of the filesystem root
    qualifies, so no list of special paths needs maintaining. Direct markers are
    checked before this and still win, so a project that genuinely sits at one of
    these paths is unaffected.
    """
    if home is not None and path == home:
        return True
    depth = len([p for p in path.split(os.sep) if p])
    if depth == 0:
        # The filesystem root is never a project root, `git init /` notwithstanding
        # — without this floor the repo exemption re-opens the 50-115s scan of /
        # that the depth rule exists to prevent. Deliberate trade: a `COPY . /`
        # image with .git at / goes unrecognised (use AXIOM_SESSION_CONTEXT=always),
        # which is rarer than a minute-long stall on every prompt.
        return True
    if is_repo_root:
        # A .git directory IS a project boundary, so containment is meaningful
        # even at a shallow path. Without this, a repo checked out at a
        # container-style workdir (/app, /workspace, /src — all one component)
        # with its markers in a subdirectory would be refused and Axiom would go
        # silently off: the cardinal sin, and a REGRESSION against pre-GH-#52
        # behaviour, which detected those correctly.
        return False
    return depth <= 1


def is_apple_project(start: str) -> bool:
    """True if `start` is inside, or contains, an Apple project.

    Upward pass: scan each level for markers (catching ancestor markers when
    opened in a subdir) and find the git root. Downward pass: bounded scan from
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
        found_repo_root = False
        prev = None
        levels = 0
        while True:
            # Marker scan is bounded to UPWARD_MAX_LEVELS ancestors (the no-git
            # "opened in a subdir" case). The .git search below is deliberately
            # NOT bounded by that cap — a git root is found however deep we were
            # opened, so a real Apple repo opened many directories deep is never
            # misread as non-Apple (the cap used to short-circuit this — GH #45).
            if levels <= UPWARD_MAX_LEVELS and _dir_has_marker(cur):
                return True
            if os.path.exists(os.path.join(cur, ".git")):  # file (worktree) or dir
                # A .git at $HOME (dotfiles repo) must NOT widen the scan root:
                # doing so hands the whole home directory to the vacuous-root
                # check, which then refuses — silently disabling Axiom for every
                # real project under ~ whose markers sit in a subdirectory. Stop
                # ascending, but keep the original start as the scan root.
                if home is None or cur != home:
                    scan_root = cur            # repo root → scan repo-wide
                    found_repo_root = True
                elif prev is not None:
                    # $HOME is the repo root (dotfiles). Scanning all of ~ is the
                    # GH #52 bug; scanning from a deep cwd misses a marker that
                    # sits up-and-over (App/ios/ when opened in App/Sources/x).
                    # The branch of ~ we actually came through is both.
                    scan_root = prev
                break
            parent = os.path.dirname(cur)
            if parent == cur:
                break                          # filesystem root
            if home is not None and cur == home:
                break                          # do not ascend past $HOME (scanned above)
            prev = cur
            levels += 1
            cur = parent
        if _is_vacuous_scan_root(scan_root, home, found_repo_root):
            return False
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
