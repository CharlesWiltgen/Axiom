#!/usr/bin/env python3
"""Swift Guardrails — PostToolUse hook for .swift edits (Claude Code / Codex).

Catches latent bug classes the compiler can't, as code is written:
  - @State without an explicit access level          → BLOCK (decision:"block")
  - SwiftData to-many @Relationship without a default → WARN  (advisory)

New checks are one entry in _CHECKS (name, tier, detector fn, header) — the
aggregation, tier handling, and JSON output are generic.

Harness-agnostic input boundary — reads tool_input from the stdin JSON, never an
env var, so ONE script serves both harnesses:
  - Claude Code Write/Edit: tool_input.file_path (a single, absolute path).
  - Codex apply_patch:       tool_input carries a freeform multi-file patch (under
    `command` in Codex 0.142); affected paths come from its "*** Update/Add File:"
    headers, are workspace-relative, and resolve against the stdin `cwd`.

Output on stdout (JSON), three cases:
  - nothing found          → no output
  - a block-tier finding   → {"decision":"block","reason":...,"hookSpecificOutput":{...}}
  - advisory-only findings → {"hookSpecificOutput":{...}}  (no decision → non-blocking)

The hook NEVER fails: malformed/empty stdin, an unreadable file, or a decode error
all yield exit 0 with no block — a broken guardrail must never block a legit edit.

Escape hatch: a trailing `// axiom-ignore` silences every check on that line;
`// axiom-ignore:<name>` silences one (names: `state`, `relationship`). Names are
comma-separated with no spaces.

Known limitation: a verbatim guardrail pattern (e.g. `@State var`) inside a triple-quoted
multi-line string is skipped via a heuristic line scan; an unbalanced triple-quote (e.g.
one in a comment) can over-skip following lines — always the safe direction (a missed
warning, never a wrong block).

The detection functions take a list of lines and are pure, so they unit-test without
disk or a subprocess; main() is the only I/O boundary.
"""
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Callable


# --- input boundary ---------------------------------------------------------

def parse_patch(text: str) -> list[str]:
    """Affected paths from an apply_patch body (its *** Update/Add File: headers).

    Delete File is ignored — nothing remains on disk to check.
    """
    out = []
    for line in text.splitlines():
        m = re.match(r"\*\*\* (?:Update|Add) File: (.+)", line)
        if m:
            out.append(m.group(1).strip())
    return out


def affected_swift_files(stdin_text: str) -> list[str]:
    """The .swift paths an edit touched, from either harness's tool_input shape."""
    try:
        data = json.loads(stdin_text)
    except Exception:
        return []
    if not isinstance(data, dict):
        return []

    cwd = data.get("cwd")
    ti = data.get("tool_input")
    paths: list[str] = []
    if isinstance(ti, dict):
        fp = ti.get("file_path")
        if isinstance(fp, str) and fp:
            paths.append(fp)  # Claude Code Write/Edit
        # Codex apply_patch nests the freeform patch under a key (confirmed "command"
        # in 0.142). Scan every string value for patch headers, key-agnostically.
        for v in ti.values():
            if isinstance(v, str) and "*** " in v:
                paths.extend(parse_patch(v))
    elif isinstance(ti, str):
        paths.extend(parse_patch(ti))  # defensive: bare patch string

    out: list[str] = []
    seen: set[str] = set()
    for p in paths:
        if not p.endswith(".swift"):
            continue
        # apply_patch paths are workspace-relative; resolve against the stdin cwd so the
        # on-disk check works regardless of the cwd the hook process was spawned with.
        if not os.path.isabs(p) and isinstance(cwd, str) and cwd:
            p = os.path.join(cwd, p)
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


# --- shared helpers ---------------------------------------------------------

def _ignored(line: str, check: str) -> bool:
    """True if `// axiom-ignore` (all checks) or `// axiom-ignore:<check>` applies."""
    m = re.search(r"axiom-ignore(?::([\w,]+))?", line)
    if not m:
        return False
    return m.group(1) is None or check in m.group(1).split(",")


def _previewable(lines: list[str], i: int) -> bool:
    """True if the @State on line `i` is @Previewable — inline or on a preceding
    attribute line. Such a var lives in a #Preview closure's LOCAL scope, where Swift
    forbids access modifiers ("Attribute 'private' can only be used in a non-local
    scope"), so the "@State private var" fix would not compile.
    """
    prev = lines[i].find("@Previewable")
    if prev != -1 and prev < lines[i].find("@State"):  # inline: attribute precedes @State
        return True
    j = i - 1
    while j >= 0 and lines[j].lstrip().startswith("@"):  # consecutive attribute lines
        if "@Previewable" in lines[j]:
            return True
        j -= 1
    return False


def _multiline_string_lines(lines: list[str]) -> set[int]:
    """Indices of lines that fall inside a Swift `\"\"\"` multi-line string literal.

    Heuristic: a line with an odd count of `\"\"\"` toggles the in-string state;
    interior lines (and the closing line) are returned. It fails safe — a miscount
    over-skips (a missed warning), never produces a wrong block.
    """
    inside: set[int] = set()
    in_str = False
    for i, line in enumerate(lines):
        odd = line.count('"""') % 2 == 1
        if in_str:
            inside.add(i)
            if odd:
                in_str = False
        elif odd:
            in_str = True
    return inside


# --- checks (pure: list[str] -> list[(lineno, text)]) -----------------------

_ACCESS = r"(?:private|fileprivate|internal|public|package|open)"


def check_state(lines: list[str]) -> list[tuple[int, str]]:
    """@State without an explicit access level (block-tier).

    Drops false positives: a modifier on either side of @State, an @Previewable @State
    in a #Preview closure (local scope forbids `private`), the axiom-ignore escape hatch,
    a // comment preceding the match, a same-line string literal, and lines inside a
    multi-line string.
    """
    skip = _multiline_string_lines(lines)
    hits = []
    for i, line in enumerate(lines):
        if i in skip:
            continue
        if not re.search(r"@State\s+var\b", line):
            continue
        if re.search(_ACCESS + r"\s+@State|@State\s+" + _ACCESS, line):
            continue
        if _previewable(lines, i):
            continue
        if _ignored(line, "state"):
            continue
        if re.search(r"//.*@State\s+var", line):
            continue  # commented-out / doc comment
        if re.search(r'".*@State\s+var', line):
            continue  # inside a string literal
        hits.append((i + 1, line.strip()))
    return hits


def check_relationship(lines: list[str]) -> list[tuple[int, str]]:
    """SwiftData to-many @Relationship (array or Set) without a default (warn-tier).

    A to-many relationship with no `= []` default compiles clean but crashes at runtime
    when SwiftData reads it. The attribute may sit on the var line or up to 3 lines
    above it. Skips to-one (non-collection / optional), already-defaulted, dictionary,
    commented, string-literal, multi-line-string, and axiom-ignore'd declarations.
    """
    skip = _multiline_string_lines(lines)
    hits = []
    n = len(lines)
    for i, line in enumerate(lines):
        if i in skip:
            continue
        if "@Relationship" not in line:
            continue
        stripped = line.lstrip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        rel = line.find("@Relationship")
        cmt = line.find("//")
        if cmt != -1 and cmt < rel:
            continue  # @Relationship sits inside a trailing comment
        if '"' in line[:rel]:
            continue  # inside a string literal
        if _ignored(line, "relationship"):
            continue
        # The var may be on this line or on a following non-blank line (attribute above).
        decl, j = line[rel:], i
        while "var " not in decl and j + 1 < n and j - i < 3:
            j += 1
            if lines[j].strip() == "" or _ignored(lines[j], "relationship"):
                decl = ""
                break
            decl += " " + lines[j].strip()
        # to-many = an array [T], a Set<T>, or a long-form Array<T>; a dictionary
        # [K: V] is NOT a to-many (the array branch's [^\]:] excludes the colon).
        m = re.search(r"var\s+\w+\s*:\s*(\[[^\]:]+\]|Set<[^>]+>|Array<[^>]+>)", decl)
        if not m:
            continue
        tail = decl[m.end():].lstrip()
        if tail.startswith("?"):
            continue  # optional to-many — defaults to nil, no `= []` needed
        # a default may sit right after the type, or on the continuation line below it.
        if tail.startswith("=") or (j + 1 < n and lines[j + 1].lstrip().startswith("=")):
            continue
        hits.append((i + 1, line.strip()))
    return hits


# --- the guardrail series ---------------------------------------------------

_STATE_REASON = (
    "Swift guardrail: @State properties must have an explicit access level "
    "(use @State private var) so child views can't fork the source of truth. Fix the "
    "flagged @State line(s) before continuing; any advisories follow in additionalContext."
)


@dataclass(frozen=True)
class _Check:
    """One guardrail rule. Adding a check = adding an entry to _CHECKS, nothing else."""

    name: str  # the // axiom-ignore:<name> token
    tier: str  # "block" (stop the edit) | "warn" (advise only)
    fn: Callable[[list[str]], list[tuple[int, str]]]  # pure: lines -> [(lineno, text)]
    header: str  # section header shown in additionalContext
    reason: str = ""  # block-tier checks contribute this to the JSON "reason"


# Order = display order; block-tier first by convention.
_CHECKS: list[_Check] = [
    _Check(
        "state", "block", check_state,
        "@State without access control (use @State private var):", _STATE_REASON,
    ),
    _Check(
        "relationship", "warn", check_relationship,
        "to-many @Relationship without a default (add = []):",
    ),
]


# --- emission ---------------------------------------------------------------

def _section(path: str, header: str, hits: list[tuple[int, str]]) -> str:
    detail = "\n".join(f"{n}:{text}" for n, text in hits)
    return f"\n⚠️ {path}: {header}\n{detail}\n"


def build_response(stdin_text: str) -> dict | None:
    """The JSON object to print, or None when there's nothing to say."""
    sections: list[str] = []
    reasons: list[str] = []
    blocking = False
    for path in affected_swift_files(stdin_text):
        # PostToolUse runs after the edit, so the file is on disk. A path we can't
        # resolve or read is skipped, never failed.
        if not os.path.isfile(path):
            continue
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                lines = f.read().splitlines()
        except Exception:
            continue
        for check in _CHECKS:
            hits = check.fn(lines)[:3]
            if not hits:
                continue
            sections.append(_section(path, check.header, hits))
            if check.tier == "block":
                blocking = True
                if check.reason and check.reason not in reasons:
                    reasons.append(check.reason)

    if not sections:
        return None
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "".join(sections),
        }
    }
    if blocking:
        reason = " ".join(reasons) or "Swift guardrail: fix the flagged line(s) before continuing."
        return {"decision": "block", "reason": reason, **output}
    return output


def main() -> None:
    try:
        response = build_response(sys.stdin.read())
    except Exception:
        sys.exit(0)  # never fail the edit
    if response is not None:
        print(json.dumps(response))
    sys.exit(0)


if __name__ == "__main__":
    main()
