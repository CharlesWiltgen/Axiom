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

    Zero or more lines on stdout, each starting with ``💡``. Each line
    is a self-contained hint the agent can act on.

Exit code: always 0.
"""
import json
import os
import re
import sys

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
            f"💡 Long xcodebuild ({seconds}s) ended in failure. Check for "
            "zombie processes: `ps aux | grep xcodebuild | wc -l`. "
            "Try: /axiom:fix-build"
        )
    return hints


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0  # malformed input → silent no-op
    if not isinstance(data, dict):
        return 0
    if data.get("tool_name") != "Bash":
        return 0

    output = os.environ.get("CLAUDE_TOOL_OUTPUT", "")
    tool_input = data.get("tool_input") or {}
    command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
    duration_ms = data.get("duration_ms")
    if not isinstance(duration_ms, int):
        duration_ms = None

    for hint in match_patterns(output):
        print(hint)
    for hint in duration_hints(command, output, duration_ms):
        print(hint)
    return 0


if __name__ == "__main__":
    sys.exit(main())
