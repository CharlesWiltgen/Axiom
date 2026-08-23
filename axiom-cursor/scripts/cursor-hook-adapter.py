#!/usr/bin/env python3
"""Bounded, fail-open bridge from Cursor hooks to Axiom's canonical hooks."""

from __future__ import annotations

import json
import os
import re
import selectors
import signal
import stat
import subprocess
import sys
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple

# Importing the sibling detector would otherwise write __pycache__ into the plugin
# directory Cursor manages. A hook must not litter the user's install.
sys.dont_write_bytecode = True


MAX_STDIN_BYTES = 1024 * 1024
MAX_CHILD_OUTPUT_BYTES = 64 * 1024
# Keep the post-write boundary deliberately small. Files above 1 MiB fail open
# without a scan.
MAX_POST_WRITE_FILE_BYTES = 1024 * 1024
# The canonical router ignores prompts under 5 chars and caps its scan at 2000.
MIN_ROUTED_PROMPT_CHARS = 5
MAX_ROUTED_PROMPT_CHARS = 2000
MAX_ROUTED_CONTEXT_CHARS = 2048
# Cursor gives this hook 5 seconds. Leave 1.25 seconds for process-group teardown
# and JSON emission if the canonical child reaches its internal deadline.
CHILD_TIMEOUT_SECONDS = 3.75
SCRIPT_DIRECTORY = os.path.dirname(os.path.abspath(__file__))

_SWIFT_FINDINGS: Tuple[Tuple[str, str, str], ...] = (
    (
        "@State without access control (use @State private var):",
        "AXIOM_SWIFT_STATE_ACCESS",
        "Add an explicit access level to this @State property (usually @State private var).",
    ),
    (
        "to-many @Relationship without a default (add = []):",
        "AXIOM_SWIFTDATA_RELATIONSHIP_DEFAULT",
        "Add a default (= []) to this to-many @Relationship.",
    ),
)


class AdapterError(Exception):
    """A safely-reportable input or child-process failure."""


def diagnostic(code: str) -> None:
    print("[axiom-cursor-hook] {}".format(code), file=sys.stderr)


def read_payload() -> Dict[str, Any]:
    raw = sys.stdin.buffer.read(MAX_STDIN_BYTES + 1)
    if len(raw) > MAX_STDIN_BYTES:
        raise AdapterError("input too large")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise AdapterError("malformed input")
    if not isinstance(payload, dict):
        raise AdapterError("malformed input")
    return payload


def signal_child(process: subprocess.Popen, child_signal: int) -> None:
    try:
        if process.pid != os.getpgrp():
            os.killpg(process.pid, child_signal)
            return
    except (OSError, ProcessLookupError):
        pass
    try:
        process.send_signal(child_signal)
    except OSError:
        pass


def close_pipe(selector: selectors.BaseSelector, pipe: Any) -> None:
    try:
        selector.unregister(pipe)
    except (KeyError, ValueError):
        pass
    try:
        pipe.close()
    except OSError:
        pass


def stop_and_drain(process: subprocess.Popen, selector: selectors.BaseSelector) -> None:
    signal_child(process, signal.SIGTERM)
    drain_deadline = time.monotonic() + 0.25
    while selector.get_map() and time.monotonic() < drain_deadline:
        for key, _ in selector.select(0.05):
            try:
                chunk = os.read(key.fd, 8192)
            except OSError:
                chunk = b""
            if not chunk:
                close_pipe(selector, key.fileobj)
    signal_child(process, signal.SIGKILL)
    for key in list(selector.get_map().values()):
        close_pipe(selector, key.fileobj)
    try:
        process.wait(timeout=0.25)
    except subprocess.TimeoutExpired:
        signal_child(process, signal.SIGKILL)
        try:
            process.wait(timeout=0.25)
        except subprocess.TimeoutExpired:
            pass


def run_child(filename: str, payload: Dict[str, Any], env: Optional[Dict[str, str]] = None, cwd: Optional[str] = None) -> str:
    child = os.path.join(SCRIPT_DIRECTORY, filename)
    if not os.path.isfile(child):
        raise AdapterError("missing child")
    child_input = json.dumps(payload).encode("utf-8")
    selector = selectors.DefaultSelector()
    process: Optional[subprocess.Popen] = None
    buffers = {"stdout": bytearray(), "stderr": bytearray()}
    failure: Optional[str] = None
    try:
        with tempfile.TemporaryFile() as stdin_file:
            stdin_file.write(child_input)
            stdin_file.seek(0)
            process = subprocess.Popen(
                [sys.executable, "-B", child],  # -B: no __pycache__ in the plugin directory
                stdin=stdin_file,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                cwd=cwd,
                start_new_session=True,
            )
            assert process.stdout is not None
            assert process.stderr is not None
            selector.register(process.stdout, selectors.EVENT_READ, "stdout")
            selector.register(process.stderr, selectors.EVENT_READ, "stderr")
            deadline = time.monotonic() + CHILD_TIMEOUT_SECONDS
            while selector.get_map():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    failure = "child timeout"
                    break
                events = selector.select(remaining)
                if not events:
                    failure = "child timeout"
                    break
                for key, _ in events:
                    stream = key.data
                    buffer = buffers[stream]
                    read_size = min(8192, MAX_CHILD_OUTPUT_BYTES + 1 - len(buffer))
                    try:
                        chunk = os.read(key.fd, read_size)
                    except OSError:
                        chunk = b""
                    if not chunk:
                        close_pipe(selector, key.fileobj)
                        continue
                    buffer.extend(chunk)
                    if len(buffer) > MAX_CHILD_OUTPUT_BYTES:
                        failure = "child output too large"
                        break
                if failure is not None:
                    break
            if failure is None:
                try:
                    process.wait(timeout=max(0, deadline - time.monotonic()))
                except subprocess.TimeoutExpired:
                    failure = "child timeout"
    except OSError:
        failure = "child launch failure"
    finally:
        if process is not None and (failure is not None or selector.get_map()):
            stop_and_drain(process, selector)
        selector.close()
    if failure is not None:
        raise AdapterError(failure)
    assert process is not None
    if process.returncode != 0:
        raise AdapterError("child failure")
    return bytes(buffers["stdout"]).decode("utf-8", errors="replace")


def _workspace_root(payload: Dict[str, Any]) -> str:
    """Best available workspace directory for a Cursor hook payload.

    Cursor sends `cwd` on some events and `workspace_roots` on all of them, so prefer
    the explicit value, fall back to the first root, and only then to the adapter's own
    directory. Children run their own project gate against the directory they start in.
    """
    cwd = payload.get("cwd")
    if isinstance(cwd, str) and cwd and os.path.isdir(cwd):
        return cwd
    roots = payload.get("workspace_roots")
    if isinstance(roots, list) and roots and isinstance(roots[0], str) and os.path.isdir(roots[0]):
        return roots[0]
    return os.getcwd()


def prompt_submit(payload: Dict[str, Any]) -> Dict[str, str]:
    """Port of the canonical UserPromptSubmit router to Cursor's beforeSubmitPrompt.

    Cursor supplies the prompt text and accepts `additional_context` in the response,
    so per-prompt router injection carries over intact rather than being dropped.
    """
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or len(prompt) < MIN_ROUTED_PROMPT_CHARS:
        return {}
    if len(prompt) > MAX_ROUTED_PROMPT_CHARS:
        prompt = prompt[:MAX_ROUTED_PROMPT_CHARS]
    workspace = _workspace_root(payload)
    child_output = run_child("user-prompt-submit.py", {"prompt": prompt}, cwd=workspace)
    if not child_output.strip():
        return {}
    try:
        response = json.loads(child_output)
    except json.JSONDecodeError:
        raise AdapterError("invalid child JSON")
    if not isinstance(response, dict):
        raise AdapterError("invalid child JSON")
    specific = response.get("hookSpecificOutput")
    if not isinstance(specific, dict):
        return {}
    context = specific.get("additionalContext")
    if not isinstance(context, str):
        return {}
    context = context.strip()
    # The router emits a fixed template naming skills from its own table, never prompt
    # text, so bound the length and reject anything that is not that shape rather than
    # forwarding arbitrary child output into the model's turn.
    if not context.startswith("Axiom:") or len(context) > MAX_ROUTED_CONTEXT_CHARS:
        raise AdapterError("unexpected router context")
    if _has_control_characters(context):
        raise AdapterError("unexpected router context")
    return {"additional_context": context}


def session_start(payload: Dict[str, Any]) -> Dict[str, str]:
    try:
        from project_detect import resolve_context_decision
    except Exception as error:
        raise AdapterError("missing project detector") from error
    cwd = _workspace_root(payload)
    if not resolve_context_decision(cwd, os.environ.get("AXIOM_SESSION_CONTEXT")):
        return {}

    skill_path = os.path.join(SCRIPT_DIRECTORY, "..", "skills", "axiom-tools", "SKILL.md")
    try:
        with open(skill_path, encoding="utf-8") as skill_file:
            skill = skill_file.read()
    except OSError:
        raise AdapterError("missing session skill")

    title = next((line[2:].strip() for line in skill.splitlines() if line.startswith("# ")), "Axiom Tools")
    context = (
        "Axiom Cursor session context v1 — {}. For Apple/Swift work, check the matching "
        "axiom-* router before responding. Route environment and build questions first; then "
        "use architecture routers such as axiom-swiftui, axiom-data, and axiom-concurrency."
    ).format(title)
    return {"additional_context": context}


def post_shell(payload: Dict[str, Any]) -> Dict[str, str]:
    if payload.get("tool_name") != "Shell":
        raise AdapterError("unexpected shell tool")
    output = payload.get("tool_output")
    if not isinstance(output, str):
        raise AdapterError("malformed shell output")
    try:
        decoded_output = json.loads(output)
    except json.JSONDecodeError:
        raise AdapterError("malformed shell output")
    if not isinstance(decoded_output, dict):
        raise AdapterError("malformed shell output")

    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        raise AdapterError("malformed shell input")
    command = tool_input.get("command")
    if not isinstance(command, str):
        raise AdapterError("malformed shell input")
    output_text = "\n".join(
        value for value in (decoded_output.get("stdout"), decoded_output.get("stderr"), decoded_output.get("output"))
        if isinstance(value, str) and value
    )
    duration = payload.get("duration")
    canonical_payload: Dict[str, Any] = {
        "tool_name": "Bash",
        "tool_input": {"command": command},
    }
    # Cursor sends fractional milliseconds (e.g. 11554.364), so an int-only check
    # silently drops every duration and no duration hint can ever fire.
    if isinstance(duration, (int, float)) and not isinstance(duration, bool) and duration > 0:
        canonical_payload["duration_ms"] = int(duration)
    environment = dict(os.environ)
    environment["CURSOR_TOOL_OUTPUT"] = output_text
    child_output = run_child("posttool-bash-hints.py", canonical_payload, environment)
    lines = [line.strip() for line in child_output.splitlines() if line.strip()]
    return {"additional_context": "\n".join(lines)} if lines else {}


def _has_control_characters(value: str) -> bool:
    return any(ord(character) < 32 or ord(character) == 127 for character in value)


def _contained(pathname: str, roots: List[str]) -> bool:
    for root in roots:
        try:
            if os.path.commonpath((pathname, root)) == root:
                return True
        except ValueError:
            continue
    return False


def _validated_post_write_context(payload: Dict[str, Any]) -> Tuple[str, str, int, bytes]:
    cwd_value = payload.get("cwd")
    if cwd_value is None:
        # Cursor's postToolUse(Write) payload carries workspace_roots but no cwd
        # (verified against a live Cursor 3.17.8 capture). Fall back to the first
        # workspace root; every validation below still applies to it unchanged.
        roots_value = payload.get("workspace_roots")
        if isinstance(roots_value, list) and roots_value and isinstance(roots_value[0], str):
            cwd_value = roots_value[0]
    if (
        not isinstance(cwd_value, str)
        or not cwd_value
        or not os.path.isabs(cwd_value)
        or _has_control_characters(cwd_value)
    ):
        raise AdapterError("unsafe write cwd")
    try:
        cwd = os.path.realpath(cwd_value)
    except (OSError, ValueError):
        raise AdapterError("unsafe write cwd")
    if not os.path.isdir(cwd):
        raise AdapterError("unsafe write cwd")

    roots_value = payload.get("workspace_roots")
    roots: List[str] = []
    if roots_value is None:
        roots.append(cwd)
    else:
        if not isinstance(roots_value, list) or not roots_value:
            raise AdapterError("unsafe workspace roots")
        for value in roots_value:
            if (
                not isinstance(value, str)
                or not value
                or not os.path.isabs(value)
                or _has_control_characters(value)
            ):
                raise AdapterError("unsafe workspace roots")
            try:
                root = os.path.realpath(value)
            except (OSError, ValueError):
                raise AdapterError("unsafe workspace roots")
            if not os.path.isdir(root):
                raise AdapterError("unsafe workspace roots")
            if root not in roots:
                roots.append(root)
        if not _contained(cwd, roots):
            raise AdapterError("unsafe write cwd")

    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        raise AdapterError("malformed write input")
    file_path = tool_input.get("file_path")
    if (
        not isinstance(file_path, str)
        or not file_path
        or _has_control_characters(file_path)
    ):
        raise AdapterError("unsafe write path")
    # Treat both separators as path syntax so the same boundary is safe on POSIX
    # and Windows (where forward slashes are accepted as alternate separators).
    if ".." in re.split(r"[\\/]", file_path):
        raise AdapterError("unsafe write path")

    unresolved = file_path if os.path.isabs(file_path) else os.path.join(cwd, file_path)
    try:
        file_status = os.lstat(unresolved)
    except (OSError, ValueError):
        raise AdapterError("unsafe write file")
    if stat.S_ISLNK(file_status.st_mode) or not stat.S_ISREG(file_status.st_mode):
        raise AdapterError("unsafe write file")

    try:
        resolved_file = os.path.realpath(unresolved)
    except (OSError, ValueError):
        raise AdapterError("unsafe write path")
    if not _contained(resolved_file, roots):
        raise AdapterError("unsafe write path")

    open_flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor: Optional[int] = None
    try:
        descriptor = os.open(resolved_file, open_flags)
        opened_status = os.fstat(descriptor)
        if not stat.S_ISREG(opened_status.st_mode):
            raise AdapterError("unsafe write file")
        if opened_status.st_size > MAX_POST_WRITE_FILE_BYTES:
            raise AdapterError("write file too large")
        chunks = bytearray()
        while len(chunks) <= MAX_POST_WRITE_FILE_BYTES:
            chunk = os.read(
                descriptor,
                min(64 * 1024, MAX_POST_WRITE_FILE_BYTES + 1 - len(chunks)),
            )
            if not chunk:
                break
            chunks.extend(chunk)
        if len(chunks) > MAX_POST_WRITE_FILE_BYTES:
            raise AdapterError("write file too large")
    except AdapterError:
        raise
    except (OSError, ValueError):
        raise AdapterError("unsafe write file")
    finally:
        if descriptor is not None:
            try:
                os.close(descriptor)
            except OSError:
                pass

    line_count = chunks.count(b"\n")
    if chunks and not chunks.endswith(b"\n"):
        line_count += 1
    return resolved_file, cwd, line_count, bytes(chunks)


def _sanitized_swift_context(response: Dict[str, Any], line_count: int) -> str:
    hook_output = response.get("hookSpecificOutput")
    if not isinstance(hook_output, dict):
        return ""
    context = hook_output.get("additionalContext")
    if not isinstance(context, str) or not context:
        return ""

    findings = {code: set() for _, code, _ in _SWIFT_FINDINGS}
    active_code: Optional[str] = None
    for line in context.splitlines():
        active_code = next(
            (
                code
                for header, code, _ in _SWIFT_FINDINGS
                if line.startswith("⚠️ ") and line.endswith(": " + header)
            ),
            active_code,
        )
        if line.startswith("⚠️ ") and not any(
            line.endswith(": " + header) for header, _, _ in _SWIFT_FINDINGS
        ):
            active_code = None
            continue
        if active_code is None:
            continue
        match = re.match(r"^([1-9][0-9]{0,8}):", line)
        if match is None:
            continue
        line_number = int(match.group(1))
        if line_number <= line_count:
            findings[active_code].add(line_number)

    diagnostics = []
    for _, code, message in _SWIFT_FINDINGS:
        diagnostics.extend(
            "{} L{}: {}".format(code, line_number, message)
            for line_number in sorted(findings[code])
        )
    if not diagnostics:
        raise AdapterError("unsupported child output")
    return "\n".join(diagnostics)


def post_write(payload: Dict[str, Any]) -> Dict[str, str]:
    if payload.get("tool_name") != "Write":
        raise AdapterError("unexpected write tool")
    child = os.path.join(SCRIPT_DIRECTORY, "swift-guardrails.py")
    if not os.path.isfile(child):
        raise AdapterError("missing child")
    # Gate on the extension before any filesystem work. Validation reads up to
    # MAX_POST_WRITE_FILE_BYTES, so validating first spends that I/O on files with no
    # guardrails to run and reports "write file too large" for large non-Swift writes.
    #
    # Enforcement is unchanged: this hook is advisory, and no payload reaches the
    # guardrails child on one path but not the other (a symlink is rejected by lstat
    # before the suffix is ever consulted). The tradeoff is observability — for a
    # non-.swift path, unsafe-cwd and workspace-boundary violations are no longer
    # reported to stderr. A missing or non-string file_path still falls through to
    # full validation and keeps its diagnostic.
    tool_input = payload.get("tool_input")
    if isinstance(tool_input, dict):
        raw_path = tool_input.get("file_path")
        if isinstance(raw_path, str) and not raw_path.endswith(".swift"):
            return {}
    file_path, cwd, line_count, validated_source = _validated_post_write_context(payload)
    if not file_path.endswith(".swift"):
        return {}
    try:
        with tempfile.TemporaryDirectory(prefix="axiom-cursor-swift-") as snapshot_directory:
            snapshot_path = os.path.join(snapshot_directory, "validated.swift")
            with open(snapshot_path, "xb") as snapshot_file:
                snapshot_file.write(validated_source)
            canonical_payload = {
                "tool_name": "Write",
                "tool_input": {"file_path": snapshot_path},
                "cwd": cwd,
            }
            child_output = run_child("swift-guardrails.py", canonical_payload)
    except AdapterError:
        raise
    except OSError:
        raise AdapterError("snapshot failure")
    if not child_output.strip():
        return {}
    try:
        response = json.loads(child_output)
    except json.JSONDecodeError:
        raise AdapterError("invalid child JSON")
    if not isinstance(response, dict):
        raise AdapterError("invalid child JSON")
    context = _sanitized_swift_context(response, line_count)
    return {"additional_context": context} if context else {}


def dispatch(mode: str, payload: Dict[str, Any]) -> Dict[str, str]:
    if mode == "session-start":
        return session_start(payload)
    if mode == "post-shell":
        return post_shell(payload)
    if mode == "post-write":
        return post_write(payload)
    if mode == "prompt-submit":
        return prompt_submit(payload)
    raise AdapterError("unknown mode")


def main() -> int:
    response: Dict[str, str] = {}
    try:
        if len(sys.argv) != 2:
            raise AdapterError("unknown mode")
        response = dispatch(sys.argv[1], read_payload())
    except AdapterError as error:
        diagnostic(str(error))
    except Exception:
        diagnostic("internal failure")
    print(json.dumps(response, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
