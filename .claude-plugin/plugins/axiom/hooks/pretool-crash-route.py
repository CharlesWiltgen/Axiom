#!/usr/bin/env python3
"""PreToolUse hook that routes crash-file Read calls to xcsym.

When an agent is about to Read a crash file (.ips, legacy .crash text,
or an .xccrashpoint bundle), this hook emits additionalContext suggesting
the agent run `xcsym crash --format=summary <path>` first. The Read
still proceeds — this is purely an advisory hint, never a block.

The hint is narrow and situational: for a raw .ips or .crash file we
route straight to xcsym, for an .xccrashpoint bundle (a directory, not
a readable file) we point at the nested Logs/*.crash path users
actually want to analyze.

Input on stdin (JSON):
    {
      "session_id": "...",
      "tool_name": "Read",
      "tool_input": {"file_path": "/absolute/path"}
    }

Output on stdout (JSON) when a match fires:
    {
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": "<hint>"
      }
    }

Any other input shape (non-Read tool, missing file_path, non-crash
path, malformed JSON) → empty stdout / exit 0. The hook never fails —
a broken hook shouldn't block Read operations.
"""
import json
import sys


def classify_path(path: str) -> str:
    """Categorize a file path so the caller can pick the right hint.

    Returns one of:
      "ips"                         — .ips file
      "crash_text"                  — legacy .crash file (not inside a bundle)
      "xccrashpoint_bundle_root"    — the .xccrashpoint directory itself
      "xccrashpoint_inner_crash"    — .crash nested inside a .xccrashpoint bundle
      "xccrashpoint_inner_other"    — some other file inside a bundle
      ""                            — not a crash path
    """
    if not isinstance(path, str) or not path:
        return ""
    # Bundle root: path ends in .xccrashpoint (no trailing slash) OR
    # ends in .xccrashpoint/ (some shells surface that shape).
    if path.endswith(".xccrashpoint") or path.endswith(".xccrashpoint/"):
        return "xccrashpoint_bundle_root"
    # Inside a bundle: distinguish the nested .crash (the one the
    # user actually wants xcsym to read) from other files they might
    # be Read-ing for metadata (DistributionInfo.json, PointInfo.json).
    # The `.xccrashpoint/` token (no leading slash) covers both the
    # `/foo.xccrashpoint/inside` and `foo.xccrashpoint/inside` shapes.
    if ".xccrashpoint/" in path:
        if path.endswith(".crash"):
            return "xccrashpoint_inner_crash"
        return "xccrashpoint_inner_other"
    if path.endswith(".ips"):
        return "ips"
    if path.endswith(".crash"):
        return "crash_text"
    return ""


# Hint text is kept tight so additionalContext doesn't bloat the
# agent's context window. Each hint names the exact command the agent
# should run and why — no decision tree, no prose padding.
_HINTS = {
    "ips": (
        "This path is an .ips crash report. Before reading it as text, "
        "run `xcsym crash --format=summary \"{path}\"` — it parses the "
        "file, symbolicates against local dSYMs, and tags the crash "
        "pattern (swift_forced_unwrap, watchdog_termination, etc.). "
        "The JSON output is what you want to analyze; the raw .ips is "
        "noisy. See the axiom-tools skill (skills/xcsym-ref.md) for "
        "the full workflow."
    ),
    "crash_text": (
        "This path is an Apple legacy .crash text file (Xcode Organizer "
        "export). Run `xcsym crash --format=summary \"{path}\"` first — "
        "xcsym parses the legacy format, symbolicates via dSYM discovery, "
        "and categorizes the crash. The text file is hard to skim "
        "directly; the JSON output surfaces pattern_tag + crashed frames."
    ),
    "xccrashpoint_inner_crash": (
        "This path is a .crash file inside an .xccrashpoint bundle. Pass "
        "it directly to xcsym: `xcsym crash --format=summary \"{path}\"`. "
        "If there's also a `LocallySymbolicated/` sibling with the same "
        "timestamp, prefer that one — it already has dSYM symbols baked in."
    ),
    "xccrashpoint_bundle_root": (
        "This path is an .xccrashpoint bundle (a directory, not a file). "
        "xcsym needs a .crash text file inside it. The crash lives at "
        "`{path}/Filters/*/Logs/*.crash` — list the directory to pick the "
        "right variant and pass that path to `xcsym crash`."
    ),
    "xccrashpoint_inner_other": (
        "This file is inside an .xccrashpoint bundle but isn't the crash "
        "payload. If the goal is crash analysis, the relevant file is at "
        "`Filters/*/Logs/*.crash` under the bundle root — route that path "
        "to `xcsym crash --format=summary`."
    ),
}


def build_output(kind: str, path: str) -> dict:
    """Construct the hookSpecificOutput envelope for a matched path."""
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": _HINTS[kind].format(path=path),
        }
    }


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0  # malformed input → silent no-op
    if not isinstance(data, dict):
        return 0
    if data.get("tool_name") != "Read":
        return 0
    ti = data.get("tool_input") or {}
    if not isinstance(ti, dict):
        return 0
    path = ti.get("file_path")
    kind = classify_path(path)
    if not kind:
        return 0
    print(json.dumps(build_output(kind, path)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
