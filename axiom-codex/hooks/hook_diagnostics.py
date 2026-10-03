"""Opt-in metadata-only lifecycle diagnostics for Axiom hooks."""

from __future__ import annotations

import atexit
import json
import os
import secrets
import stat
import sys
import time

EVENTS = {
    "session-start": "SessionStart",
    "user-prompt-submit": "UserPromptSubmit",
    "subagent-start": "SubagentStart",
    "posttool-bash-hints": "PostToolUse",
    "swift-guardrails": "PostToolUse",
    "pretool-crash-route": "PreToolUse",
}
EXCEPTION_CLASSES = {
    "Exception",
    "ValueError",
    "TypeError",
    "KeyError",
    "AttributeError",
    "RuntimeError",
    "OSError",
    "PermissionError",
    "FileNotFoundError",
    "TimeoutError",
    "JSONDecodeError",
    "UnicodeDecodeError",
    "ImportError",
    "ModuleNotFoundError",
    "IndexError",
    "OverflowError",
    "RecursionError",
}
MAX_JOURNAL_BYTES = 1_048_576
NOTICE = "Axiom hook diagnostics unavailable.\n"
_state = None


def _notice():
    try:
        os.write(2, NOTICE.encode("ascii"))
    except OSError:
        pass  # A closed diagnostic sink must not change hook behavior.


def _write(phase):
    if _state is None or _state["unavailable"]:
        return
    directory_fd = file_fd = None
    try:
        destination = os.path.normpath(_state["destination"])
        if not os.path.isabs(destination):
            raise ValueError("absolute directory required")
        try:
            os.mkdir(destination, 0o700)
        except FileExistsError:
            pass
        directory_fd = os.open(
            destination,
            os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC,
        )
        directory = os.fstat(directory_fd)
        if directory.st_uid != os.getuid() or stat.S_IMODE(directory.st_mode) != 0o700:
            raise ValueError("private owned directory required")
        file_fd = os.open(
            "axiom-hooks.jsonl",
            os.O_WRONLY
            | os.O_CREAT
            | os.O_APPEND
            | os.O_NOFOLLOW
            | os.O_NONBLOCK
            | os.O_CLOEXEC,
            0o600,
            dir_fd=directory_fd,
        )
        file = os.fstat(file_fd)
        if (
            not stat.S_ISREG(file.st_mode)
            or file.st_uid != os.getuid()
            or file.st_nlink != 1
            or stat.S_IMODE(file.st_mode) != 0o600
        ):
            raise ValueError("private owned regular file required")
        # Imported only for an enabled journal: fcntl does not exist on Windows, and
        # an ImportError here is caught below like any other unavailable destination.
        import fcntl

        deadline = time.monotonic() + 0.025
        while True:
            try:
                fcntl.flock(file_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise TimeoutError("journal busy")
                time.sleep(0.001)
        record = {
            "schema_version": 1,
            "hook": _state["hook"],
            "event": EVENTS[_state["hook"]],
            "phase": phase,
            "correlation": _state["correlation"],
            "elapsed_ms": min(
                86_400_000, max(0, int((time.monotonic() - _state["started"]) * 1000))
            ),
            "outcome": "running" if phase == "start" else _state["outcome"],
            "exception_class": None if phase == "start" else _state["exception_class"],
        }
        payload = (json.dumps(record, separators=(",", ":")) + "\n").encode("ascii")
        if (
            len(payload) > 512
            or os.fstat(file_fd).st_size + len(payload) > MAX_JOURNAL_BYTES
        ):
            raise ValueError("journal capacity reached")
        if os.write(file_fd, payload) != len(payload):
            raise OSError("incomplete record")
    except Exception:  # noqa: BLE001 - diagnostics cannot interrupt hooks
        _state["unavailable"] = True
        _notice()
    finally:
        if file_fd is not None:
            try:
                os.close(file_fd)
            except OSError:
                _notice()
        if directory_fd is not None:
            try:
                os.close(directory_fd)
            except OSError:
                _notice()


def begin(hook):
    global _state
    destination = os.environ.get("AXIOM_HOOK_DIAGNOSTICS_DIR")
    if not destination:
        return
    if hook not in EVENTS or _state is not None:
        _notice()
        return
    try:
        _state = {
            "destination": destination,
            "hook": hook,
            "correlation": secrets.token_hex(16),
            "started": time.monotonic(),
            "outcome": "success",
            "exception_class": None,
            "unavailable": False,
        }
    except Exception:  # noqa: BLE001 - diagnostics cannot interrupt hooks
        _notice()
        return
    _write("start")
    atexit.register(_write, "end")
    previous_excepthook = sys.excepthook

    def report_exception(error_type, error, traceback):
        record_exception(error)
        previous_excepthook(error_type, error, traceback)

    sys.excepthook = report_exception


def record_exception(error):
    if _state is not None:
        name = type(error).__name__
        _state["exception_class"] = name if name in EXCEPTION_CLASSES else "Exception"
        _state["outcome"] = "exception"


def record_exit(code):
    if _state is not None and code != 0 and _state["outcome"] != "exception":
        _state["outcome"] = "nonzero_exit"
