#!/usr/bin/env python3
"""PostToolUse hook that suggests an Axiom skill based on Bash output.

When the model runs a Bash command, this hook scans the command's output
for known iOS error signatures and prints a short ``💡 Try: skill X``
hint on stdout. Each hint is one line; multiple hints can fire from a
single command. The hook never blocks the tool flow and never exits
non-zero — a broken hook shouldn't get in the way of normal work.

Replaces the inline bash one-liner that previously lived in
``hooks/hooks.json`` (PostToolUse Bash matcher). Extracted so we can:

1. Add unit tests (see ``posttool-bash-hints_test.py``).
2. Use ``duration_ms`` (added to PostToolUse input in CC 2.1.119) for
   duration-aware rules — currently used by the slow-xcodebuild and
   slow-test rules in this script's sibling phase.

Input:

    JSON on stdin (PostToolUse shape, per code.claude.com/docs/en/hooks):

        {
          "session_id": "...",
          "tool_name": "Bash",
          "tool_input": {"command": "...", ...},
          "tool_response": {...},          # Bash response shape undocumented
          "duration_ms": 12345,            # optional, ms
          ...
        }

    Bash output text on the ``CLAUDE_TOOL_OUTPUT`` env var. We read this
    rather than ``tool_response`` because the latter's Bash schema is
    not documented; the env var is proven (used by the previous inline
    hook). If the var is unset, we treat output as empty.

Output:

    Canonical Claude invocations emit zero or more plain-text hint lines.
    Generated invocations set ``AXIOM_HARNESS=codex`` to read terminal text
    from stdin ``tool_response`` (string or explicit ``output`` field) and
    emit one PostToolUse ``hookSpecificOutput.additionalContext`` object.
    Unknown response fields are not scanned; no hints produce no output.
    Claude/Codex completion status is unverified, so truncated-build recovery
    stays silent for those adapters. Error text cannot establish failure.

Exit code: always 0.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import sys
from typing import NamedTuple, Literal

# fmt: off
try:
    import hook_diagnostics
except ImportError:  # Diagnostics are optional; a missing module must not break the hook.
    import os as _os
    from types import SimpleNamespace

    def _diagnostics_unavailable(*_):
        # Requested but unavailable: the same fixed notice as an unwritable journal.
        if _os.environ.get("AXIOM_HOOK_DIAGNOSTICS_DIR"):
            try:
                _os.write(2, b"Axiom hook diagnostics unavailable.\n")
            except OSError:
                pass

    hook_diagnostics = SimpleNamespace(
        begin=_diagnostics_unavailable,
        record_exception=lambda *_: None,
        record_exit=lambda *_: None,
    )
# fmt: on

# Pattern hints. Each entry is (compiled_regex, hint_text). Hints are
# kept short — one line, names the skill or command to invoke. Order
# doesn't matter for correctness, but related hints are grouped for
# readability.
_PATTERN_RULES: list[tuple[re.Pattern, str]] = [
    (
        re.compile(r"Unable to simultaneously satisfy constraints"),
        "💡 Auto Layout conflict. Try: skill axiom-uikit",
    ),
    (
        re.compile(r"Actor-isolated|Sendable|data race|@MainActor"),
        "💡 Concurrency issue. Try: skill axiom-concurrency",
    ),
    (
        re.compile(r"no such column|FOREIGN KEY constraint|migration"),
        "💡 Database migration issue. Try: skill axiom-data",
    ),
    (
        re.compile(r"retain cycle|memory leak|deinit.*never called"),
        "💡 Memory issue detected. Try: skill axiom-performance",
    ),
    (
        re.compile(r"CKError|CKRecord.*error"),
        "💡 CloudKit issue. Try: skill axiom-data",
    ),
    (
        re.compile(r"ubiquitous.*error|iCloud Drive|NSFileCoordinator"),
        "💡 iCloud Drive issue. Try: skill axiom-data",
    ),
    (
        re.compile(r"file.*disappeared|file not found|storage.*full"),
        "💡 File storage issue. Try: skill axiom-data",
    ),
    (
        re.compile(r"FileProtection|data protection|file.*locked"),
        "💡 File protection issue. Try: skill axiom-data",
    ),
    (
        re.compile(r"error:.*module.*not found|linker command failed"),
        "💡 Build configuration issue. Try: /axiom:fix-build",
    ),
]


def match_patterns(output: str) -> list[str]:
    """Return every pattern hint that matches ``output``, in rule order.

    Multiple rules can fire on a single Bash output (e.g. a build that
    surfaces both a concurrency error and a linker failure).
    """
    if not output:
        return []
    return [hint for pattern, hint in _PATTERN_RULES if pattern.search(output)]


# Tokenize a Bash command so we can answer "is this an xcodebuild call"
# without being fooled by the literal token appearing inside a string,
# a comment, or a path component (e.g. `# xcodebuild test`,
# `echo "xcodebuild test"`, `/usr/local/share/xcodebuild-templates`).
_TOKEN_RE = re.compile(r"[A-Za-z0-9_./=-]+")


def _command_tokens(command: str) -> list[str]:
    """Split a command into bare word tokens, ignoring comments and quoted strings.

    This is heuristic — not a full shell parser — but sufficient to
    distinguish a real ``xcodebuild`` invocation from a mention.
    """
    if not command:
        return []
    # Drop everything after a top-level `#` (best-effort comment strip).
    # We only do this if the `#` is at start-of-line or preceded by
    # whitespace, to avoid mangling URL fragments etc.
    cleaned: list[str] = []
    for line in command.splitlines():
        # Strip line comments. Conservative: only strip if `#` follows
        # whitespace or is at start.
        stripped = re.sub(r"(^|\s)#.*$", "", line)
        cleaned.append(stripped)
    text = "\n".join(cleaned)
    # Strip quoted strings — single AND double, including their contents.
    # Order matters: handle escapes minimally (good enough for hint heuristics).
    text = re.sub(r"'[^']*'", "", text)
    text = re.sub(r'"[^"]*"', "", text)
    return _TOKEN_RE.findall(text)


def _is_xcodebuild_command(command: str) -> bool:
    """True if the command's first executable token is `xcodebuild`.

    Matches:
        xcodebuild ...
        env FOO=bar xcodebuild ...
        sudo xcodebuild ...
        /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild ...

    Doesn't match:
        echo "xcodebuild test"
        # xcodebuild test
        ls xcodebuild-templates/
    """
    tokens = _command_tokens(command)
    # Walk past common prefixes (env, sudo, nice, time) to find the
    # actual program token. Stop at the first non-prefix token.
    prefixes = {"env", "sudo", "nice", "time", "command", "exec"}
    i = 0
    while i < len(tokens) and tokens[i] in prefixes:
        i += 1
        # `env FOO=bar program` style: skip VAR=value tokens too
        while i < len(tokens) and "=" in tokens[i] and not tokens[i].startswith("/"):
            i += 1
    if i >= len(tokens):
        return False
    program = tokens[i]
    # Allow absolute path forms (`/.../xcodebuild`). Compare only the
    # basename for those.
    basename = program.rsplit("/", 1)[-1]
    return basename == "xcodebuild"


def _is_xcodebuild_test_command(command: str) -> bool:
    """True if this is an xcodebuild test invocation.

    Looks for the literal `test` (or `test-without-building`) token
    appearing as a bare word in an `xcodebuild` command.
    """
    if not _is_xcodebuild_command(command):
        return False
    tokens = _command_tokens(command)
    return any(t in {"test", "test-without-building"} for t in tokens)


# Output signatures that suggest an xcodebuild call ended in failure
# rather than just being slow. The slow-build hint is only useful when
# something actually went wrong — slow successful builds are normal on
# clean checkouts.
_BUILD_FAILURE_RE = re.compile(
    r"BUILD FAILED|\*\* BUILD FAILED \*\*|error:|linker command failed",
    re.IGNORECASE,
)


# Thresholds in milliseconds. Tunable. First-pass values:
#   Build: 60s — anything over a minute that *also* failed is worth
#          flagging; zombie xcodebuilds typically run 5-30+ minutes.
#   Test:  5min — common test suites finish in <2min; >5min usually
#          indicates parallelization opportunity.
_SLOW_BUILD_MS = 60_000

# Codex ships no /axiom:* commands; build-codex.ts maps each to the skill it emits.
_CODEX_COMMANDS = {"/axiom:fix-build": "skill axiom-fix-build"}
_SLOW_TEST_MS = 300_000


def duration_hints(command: str, output: str, duration_ms: int | None) -> list[str]:
    """Return duration-aware hints for a Bash command.

    Both rules are conservative: they require the command to actually
    be `xcodebuild` (not just any slow Bash call), and the build rule
    additionally requires failure-looking output.
    """
    if duration_ms is None or duration_ms <= 0:
        return []
    hints: list[str] = []
    seconds = duration_ms // 1000
    is_test = _is_xcodebuild_test_command(command)
    if is_test and duration_ms > _SLOW_TEST_MS:
        hints.append(
            f"💡 Slow test run ({seconds}s). Try: skill axiom-testing for "
            "parallelization, simulator reuse, .serialized traits"
        )
    elif (
        not is_test
        and _is_xcodebuild_command(command)
        and duration_ms > _SLOW_BUILD_MS
        and _BUILD_FAILURE_RE.search(output or "")
    ):
        hints.append(
            f"💡 Long xcodebuild ({seconds}s) produced error-like output. Check "
            "active processes: `pgrep -lx xcodebuild` (exit 1 means none). "
            "Try: /axiom:fix-build"
        )
    return hints


class BuildCompletion(NamedTuple):
    command: str
    output: str
    outcome: Literal["succeeded", "failed", "unknown"]


def normalize_build_completion(
    data: dict, codex: bool, environment_output: str
) -> BuildCompletion | None:
    tool_input = data.get("tool_input")
    command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
    if not isinstance(command, str):
        command = ""
    if codex:
        response = data.get("tool_response")
        output = response.get("output") if isinstance(response, dict) else response
        if not isinstance(output, str):
            return None
    else:
        output = environment_output
    # Neither adapter has a verified native completion-status contract.
    return BuildCompletion(command, output, "unknown")


def _is_unwrapped_build(command: str) -> bool:
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|()")
        lexer.whitespace_split = True
        tokens = list(lexer)
    except ValueError:
        return False
    if not tokens or any(re.fullmatch(r"[;&|()]+", token) for token in tokens):
        return False
    while tokens and (
        tokens[0] in {"env", "command", "exec", "time", "sudo"}
        or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[0])
    ):
        tokens.pop(0)
    if not tokens:
        return False
    program = tokens.pop(0).rsplit("/", 1)[-1]
    if program == "xcrun":
        while tokens and tokens[0].startswith("-"):
            option = tokens.pop(0)
            if option in {"--sdk", "--toolchain"}:
                if not tokens or tokens[0].startswith("-"):
                    return False
                tokens.pop(0)
            elif option not in {
                "-v",
                "--verbose",
                "-l",
                "--log",
                "-r",
                "--run",
                "-n",
                "--no-cache",
                "-k",
                "--kill-cache",
            }:
                return False
        if not tokens:
            return False
        program = tokens.pop(0).rsplit("/", 1)[-1]
    if program == "swift":
        return bool(
            tokens
            and tokens[0] in {"build", "test"}
            and not any(
                t in {"--help", "-h", "--help-hidden", "--version"} for t in tokens
            )
        )
    if program != "xcodebuild":
        return False
    actions = []
    values = {
        "-scheme",
        "-project",
        "-workspace",
        "-target",
        "-configuration",
        "-sdk",
        "-destination",
        "-derivedDataPath",
        "-resultBundlePath",
        "-testPlan",
    }
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token in values:
            if i + 1 == len(tokens):
                return False
            i += 2
            continue
        if token in {
            "-help",
            "-list",
            "-version",
            "-showsdks",
            "-showBuildSettings",
            "-showdestinations",
            "-showTestPlans",
        }:
            return False
        if token in {
            "build",
            "test",
            "build-for-testing",
            "test-without-building",
            "archive",
            "install",
            "analyze",
            "clean",
        }:
            actions.append(token)
        i += 1
    return not actions or any(action != "clean" for action in actions)


def truncated_build_hints(command: str, output: str, outcome: str) -> list[str]:
    if outcome != "failed" or not _is_unwrapped_build(command):
        return []
    observed = (
        re.search(r"\[(?:[0-9]+ (?:characters|lines|tokens) )?truncated\]", output)
        is not None
    )
    if not observed and len(output) < 30000:
        return []
    evidence = (
        "was truncated" if observed else "may be truncated (output-length heuristic)"
    )
    return [
        f"💡 Build output {evidence}. Read the retained log if available; use axbuild for the next necessary build/test."
    ]


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception as error:
        hook_diagnostics.record_exception(error)
        return 0  # malformed input → silent no-op
    if not isinstance(data, dict):
        return 0
    if data.get("tool_name") != "Bash":
        return 0

    try:
        from project_detect import resolve_context_decision

        if not resolve_context_decision(
            os.getcwd(), os.environ.get("AXIOM_SESSION_CONTEXT")
        ):
            return 0
    except Exception as error:
        hook_diagnostics.record_exception(error)

    codex = os.environ.get("AXIOM_HARNESS") == "codex"
    completion = normalize_build_completion(
        data, codex, os.environ.get("CLAUDE_TOOL_OUTPUT", "")
    )
    if completion is None:
        return 0
    command, output, outcome = completion
    duration_ms = data.get("duration_ms")
    if not isinstance(duration_ms, int):
        duration_ms = None

    hints = (
        match_patterns(output)
        + duration_hints(command, output, duration_ms)
        + truncated_build_hints(command, output, outcome)
    )
    if codex:
        if hints:
            context = "\n".join(hints)
            for command, skill in _CODEX_COMMANDS.items():
                context = context.replace(command, skill)
            print(
                json.dumps(
                    {
                        "hookSpecificOutput": {
                            "hookEventName": "PostToolUse",
                            "additionalContext": context,
                        }
                    },
                    ensure_ascii=False,
                )
            )
    else:
        for hint in hints:
            print(hint)
    return 0


if __name__ == "__main__":
    hook_diagnostics.begin("posttool-bash-hints")
    sys.exit(main())
