"""Opt-in installed Codex lifecycle checks using authored transport, without inference."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import select
import selectors
import shutil
import signal
import subprocess
import tempfile
import threading
import time
from collections import Counter
from contextlib import ExitStack
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

CASES = (
    "normal",
    "nested-large",
    "edit",
    "subagent",
    "timeout",
    "cancel",
    "signal",
    "exception",
    "offload",
    "parse",
    "launch",
)
PROMPT = (
    "Authored Axiom lifecycle transport fixture; follow supplied synthetic tool calls."
)
HINT = "💡 Concurrency issue. Try: skill axiom-concurrency"
HANDLERS = {
    "Axiom: SessionStart onboarding": "session-start",
    "Axiom: UserPromptSubmit routing": "user-prompt-submit",
    "Axiom: SubagentStart subagent guidance": "subagent-start",
    "Axiom: PostToolUse terminal hints": "posttool-bash-hints",
    "Axiom: PostToolUse Swift guardrails": "swift-guardrails",
}
OFFLOAD = (
    "AXIOM_OFFLOAD_HEAD\n"
    + "authored synthetic context\n" * 3000
    + "AXIOM_OFFLOAD_TAIL"
)


def signal_group(pgid, signum, bound=1.0, reap=None):
    # Darwin's killpg answers EPERM while every remaining member is an unreaped
    # zombie. Retry until the group is gone or a signal lands; EPERM that
    # outlasts the bound is a real failure. When that zombie may be the caller's
    # own exited leader, only the caller can reap it, so pass reap (Popen.poll).
    deadline = time.monotonic() + bound
    while True:
        try:
            os.killpg(pgid, signum)
            return
        except ProcessLookupError:
            return
        except PermissionError:
            if time.monotonic() >= deadline:
                raise
            if reap is not None:
                reap()
        time.sleep(0.01)


def run_command(command, env, timeout):
    process = subprocess.Popen(
        command,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, stderr = process.communicate(timeout=timeout)
        if process.returncode:
            raise subprocess.CalledProcessError(process.returncode, command)
        return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
    finally:
        signal_group(process.pid, signal.SIGKILL, reap=process.poll)
        process.wait(timeout=3)
        process.stdout.close()
        process.stderr.close()


def diagnostics_valid(records, completed, started, cancelled):
    correlations = {record["correlation"] for record in records}
    pair_counts = Counter()
    record_counts = Counter()
    for correlation in correlations:
        group = [r for r in records if r["correlation"] == correlation]
        phases = [r["phase"] for r in group]
        hook = group[0]["hook"]
        if any(r["hook"] != hook for r in group) or phases not in (
            ["start"],
            ["start", "end"],
        ):
            return False
        record_counts[hook] += 1
        pair_counts[hook] += phases == ["start", "end"]
    completed_counts, started_counts = Counter(completed), Counter(started)
    if cancelled:
        return bool(correlations) and all(
            completed_counts[hook]
            <= pair_counts[hook]
            <= record_counts[hook]
            <= started_counts[hook]
            for hook in set(record_counts) | set(completed_counts)
        )
    return bool(correlations) and completed_counts == pair_counts == record_counts


def context_present(context, serialized):
    return bool(context) and json.dumps(context, ensure_ascii=False)[1:-1] in serialized


def classify(status, entries):
    if status != "failed":
        return status
    text = "\n".join(
        e.get("text", "") for e in entries if e.get("kind") == "error"
    ).lower()
    for needles, outcome in (
        (("timed out", "timeout"), "timeout"),
        (("without a status code",), "status_missing"),
        (("exited with", "exit code"), "process_exit"),
        (("invalid json", "parse", "deserialize"), "parse_error"),
        (("spawn", "launch", "no such file"), "launch_error"),
        (("stdin", "write input"), "stdin_error"),
    ):
        if any(needle in text for needle in needles) or (
            outcome == "parse_error" and "invalid" in text and "json" in text
        ):
            return outcome
    return "unknown_failure"


def completed_child(output, target):
    try:
        result = json.loads(output)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(result, dict) or not isinstance(result.get("status"), dict):
        return False
    status = result["status"].get(target)
    return (
        isinstance(status, dict) and status.get("completed") == "AXIOM_CHILD_COMPLETE"
    )


def retain(directory: Path, report):
    directory.mkdir(parents=True, exist_ok=True)
    owned = Path(tempfile.mkdtemp(prefix="lifecycle-", dir=directory))
    target = owned / "report.json"
    with target.open("x") as output:
        os.chmod(target, 0o600)
        json.dump(report, output, indent=2)
        output.write("\n")
    return target


class HarnessError(Exception):
    def __init__(self, kind):
        self.kind = kind
        super().__init__(kind)


class Runner:
    def __init__(self, binary, cwd, env, stderr):
        self.process = subprocess.Popen(
            [binary, "app-server", "--stdio"],
            cwd=cwd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=stderr,
            start_new_session=True,
        )
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ)
        self.buffer = b""
        self.messages = []
        self.next_id = 0

    def send(self, message, seconds=25):
        pending = memoryview((json.dumps(message) + "\n").encode())
        descriptor = self.process.stdin.fileno()
        os.set_blocking(descriptor, False)
        deadline = time.monotonic() + seconds
        try:
            while pending:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise HarnessError("io_timeout")
                if select.select([], [descriptor], [], min(0.1, remaining))[1]:
                    try:
                        pending = pending[os.write(descriptor, pending) :]
                    except BlockingIOError:
                        continue
        except OSError as error:
            raise HarnessError("io_error") from error

    def until(self, predicate, seconds=25):
        deadline = time.monotonic() + seconds
        while not predicate():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise HarnessError("harness_timeout")
            for key, _ in self.selector.select(min(0.1, remaining)):
                chunk = os.read(key.fd, 65536)
                if not chunk:
                    raise HarnessError("runner_exit")
                self.buffer += chunk
                if len(self.buffer) > 4_000_000:
                    raise HarnessError("rpc_size_limit")
                while b"\n" in self.buffer:
                    line, self.buffer = self.buffer.split(b"\n", 1)
                    try:
                        self.messages.append(json.loads(line))
                    except json.JSONDecodeError as error:
                        raise HarnessError("rpc_parse_error") from error

    def call(self, method, params):
        self.next_id += 1
        rpc_id = self.next_id
        self.send({"id": rpc_id, "method": method, "params": params})
        self.until(lambda: any(m.get("id") == rpc_id for m in self.messages))
        response = next(m for m in self.messages if m.get("id") == rpc_id)
        if "error" in response:
            raise HarnessError("rpc_error")
        return response["result"]

    def close(self):
        signal_group(self.process.pid, signal.SIGTERM, reap=self.process.poll)
        try:
            self.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            signal_group(self.process.pid, signal.SIGKILL, reap=self.process.poll)
            self.process.wait(timeout=3)
        signal_group(self.process.pid, signal.SIGKILL, reap=self.process.poll)
        self.selector.close()
        self.process.stdin.close()
        self.process.stdout.close()


def fingerprint(package):
    return {
        str(p.relative_to(package)): {
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            "mode": p.stat().st_mode & 0o777,
        }
        for p in sorted(package.rglob("*"))
        if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"
    }


def run_case(binary, package, case):
    report = {
        "schema_version": 1,
        "case": case,
        "status": "failed",
        "test_kind": "authored deterministic transport; no model inference",
        "model": None,
        "effort": None,
        "trust_override": "ephemeral thread bypass_hook_trust; persistent trust unchanged",
        "harness_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "transport_model": "axiom-synthetic-fixture",
        "checks": {},
        "persistent_configuration_changed": False,
        "credentials_accessed": False,
    }
    try:
        _run_case(binary, package, case, report)
    except Exception as error:  # noqa: BLE001 - retain sanitized fixture failures
        if "harness_error" in report:
            report["cleanup_error"] = type(error).__name__
        else:
            report["harness_error"] = "postprocessing_error"
        report["exception_class"] = type(error).__name__
    statuses = report.get("turn_statuses", [])
    report["checks"]["turn_outcome"] = (
        statuses == ["interrupted"]
        if case == "cancel"
        else bool(statuses) and all(status == "completed" for status in statuses)
    )
    if case in ("normal", "nested-large"):
        report["checks"]["terminal_exit_zero"] = report.get("terminal_exit_codes") == [
            0
        ]
    if case == "subagent" and "capability_unavailable" not in report:
        report["checks"]["complete_child_context_delivery"] = any(
            request.get("child") and request.get("subagent_context_complete")
            for request in report.get("transport", {}).get("requests", [])
        )
        report["checks"]["child_turn_completed"] = report.get("child_completed") is True
    if (
        "harness_error" not in report
        and report["checks"]
        and all(report["checks"].values())
    ):
        report["status"] = (
            "unavailable" if "capability_unavailable" in report else "passed"
        )
    return report


def _run_case(binary, package, case, report):
    runner = None
    server = None
    state = {"requests": [], "errors": [], "tools": []}
    texts = []
    child_identity = {"target": None}
    with (
        tempfile.TemporaryDirectory(
            prefix="axiom-lifecycle-", dir="/private/tmp"
        ) as temporary,
        ExitStack() as cleanup,
    ):
        root = Path(temporary)
        home = root / "home"
        config = home / ".codex"
        workspace = root / "workspace"
        config.mkdir(parents=True)
        workspace.mkdir()
        (workspace / "Example.swift").write_text("// Authored Axiom fixture\n")
        if case == "nested-large":
            workspace = workspace / "nested"
            workspace.mkdir()
        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": str(home),
            "CODEX_HOME": str(config),
            "TMPDIR": str(root),
            "AXIOM_SESSION_CONTEXT": "always",
            "AXIOM_HOOK_DIAGNOSTICS_DIR": str(root / "diagnostics"),
        }
        try:
            report["runtime_version"] = run_command(
                [binary, "--version"], env, 5
            ).stdout.strip()
            report["source_fingerprints"] = fingerprint(package)
            market = root / "marketplace"
            (market / ".claude-plugin").mkdir(parents=True)
            shutil.copytree(package, market / "axiom-codex")
            (market / ".claude-plugin/marketplace.json").write_text(
                json.dumps(
                    {
                        "name": "axiom-disposable",
                        "owner": {"name": "Authored Axiom fixture"},
                        "plugins": [{"name": "axiom", "source": "./axiom-codex"}],
                    }
                )
            )
            for command in (
                [binary, "plugin", "marketplace", "add", str(market), "--json"],
                [binary, "plugin", "add", "axiom@axiom-disposable", "--json"],
            ):
                result = run_command(command, env, 15)
                installed = json.loads(result.stdout)
            installed_package = Path(installed["installedPath"])
            if not installed_package.is_relative_to(config):
                raise HarnessError("installation_not_isolated")
            report["plugin_id"] = installed["pluginId"]
            report["plugin_version"] = installed["version"]
            report["checks"]["installed_byte_and_mode_fidelity"] = (
                fingerprint(installed_package) == report["source_fingerprints"]
            )
            report["checks"]["no_user_hook_copy"] = not (config / "hooks.json").exists()
            if case in (
                "timeout",
                "cancel",
                "signal",
                "exception",
                "offload",
                "parse",
                "launch",
            ):
                fixture = root / "fixture.py"
                fixture.write_text(
                    "import json,os,signal,sys,time\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom hook_diagnostics import begin\nos.environ['AXIOM_HOOK_DIAGNOSTICS_DIR']=sys.argv[3]\nbegin('user-prompt-submit')\n"
                    + {
                        "timeout": "time.sleep(5)\n",
                        "cancel": "Path(sys.argv[2]).write_text(str(os.getpid()))\ntime.sleep(8)\n",
                        "signal": "os.kill(os.getpid(),signal.SIGTERM)\n",
                        "exception": "raise RuntimeError('AUTHORED_SYNTHETIC_EXCEPTION')\n",
                        "offload": 'print(json.dumps({"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":'
                        + repr(OFFLOAD)
                        + "}}))\n",
                        "parse": "print('{AUTHORED_INVALID_JSON')\n",
                        "launch": "",
                    }[case]
                )
                command = (
                    'exec python3 "'
                    + str(fixture)
                    + '" "'
                    + str(installed_package / "hooks")
                    + '" "'
                    + str(root / "started")
                    + '" "'
                    + str(root / "synthetic-diagnostics")
                    + '"'
                )
                if case == "launch":
                    command = "exec /axiom-authored-absent-command"
                handler = {
                    "type": "command",
                    "command": command,
                    "statusMessage": "Axiom synthetic lifecycle: " + case,
                    "timeout": 1 if case == "timeout" else 10,
                }
                if case == "offload":
                    handler["additionalContextLimit"] = 100
                (config / "hooks.json").write_text(
                    json.dumps({"hooks": {"UserPromptSubmit": [{"hooks": [handler]}]}})
                )
                report["synthetic_handler_sha256"] = hashlib.sha256(
                    fixture.read_bytes()
                ).hexdigest()

            class Provider(BaseHTTPRequestHandler):
                def log_message(self, *_):
                    pass

                def do_POST(self):
                    try:
                        self.connection.settimeout(5)
                        size = int(self.headers.get("Content-Length", "0"))
                        if not 0 < size <= 4_000_000:
                            raise HarnessError("provider_size_limit")
                        body = json.loads(self.rfile.read(size))
                        serialized = json.dumps(
                            body.get("input", []), ensure_ascii=False
                        )
                        texts.append(serialized)
                        tools = []
                        for tool in body.get("tools", []):
                            if tool.get("type") == "namespace":
                                tools.extend(
                                    (tool["name"] + "." + child["name"], child)
                                    for child in tool.get("tools", [])
                                )
                            else:
                                tools.append((tool.get("name", tool.get("type")), tool))
                        state["tools"] = sorted(
                            set(state["tools"]) | {name for name, _ in tools}
                        )
                        child = (
                            "AXIOM_CHILD_FIXTURE" in serialized
                            and "AXIOM_PARENT_FIXTURE" not in serialized
                        )
                        parent_requests = sum(not r["child"] for r in state["requests"])
                        state["requests"].append(
                            {
                                "child": child,
                                "hint_present": HINT in serialized,
                                "startup_present": "Axiom provides Apple-platform development guidance."
                                in serialized,
                                "offload_preview": "AXIOM_OFFLOAD_HEAD" in serialized
                                and "AXIOM_OFFLOAD_TAIL" in serialized,
                                "offload_full_in_request": context_present(
                                    OFFLOAD, serialized
                                ),
                            }
                        )
                        item = {
                            "id": "fixture-message",
                            "type": "message",
                            "role": "assistant",
                            "status": "completed",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": "AXIOM_TRANSPORT_COMPLETE",
                                    "annotations": [],
                                }
                            ],
                        }
                        if (
                            parent_requests == 0
                            and not child
                            and case in ("normal", "nested-large", "edit", "subagent")
                        ):
                            leaf = {
                                "normal": "exec_command",
                                "nested-large": "exec_command",
                                "edit": "apply_patch",
                                "subagent": "spawn_agent",
                            }[case]
                            candidate = next(
                                (
                                    (name, tool)
                                    for name, tool in tools
                                    if name.rsplit(".", 1)[-1] == leaf
                                ),
                                None,
                            )
                            if candidate:
                                name, tool = candidate
                                args = {
                                    "cmd": "printf '%s\\n' 'error: Actor-isolated property in Sendable closure; possible data race'",
                                    "yield_time_ms": 1000,
                                    "max_output_tokens": 500,
                                }
                                if case == "subagent":
                                    args = {
                                        "message": "AXIOM_CHILD_FIXTURE. Return AXIOM_CHILD_COMPLETE immediately.",
                                        "fork_context": False,
                                    }
                                if case == "edit":
                                    patch = "*** Begin Patch\n*** Add File: Fixture.swift\n+// Authored Axiom edit fixture\n*** End Patch"
                                    args = {
                                        "cmd": "apply_patch <<'AXIOM_PATCH'\n"
                                        + patch
                                        + "\nAXIOM_PATCH",
                                        "yield_time_ms": 1000,
                                        "max_output_tokens": 500,
                                    }
                                    if tool.get("type") == "custom":
                                        item = {
                                            "id": "fixture-call",
                                            "type": "custom_tool_call",
                                            "call_id": "fixture-call",
                                            "name": name,
                                            "input": patch,
                                        }
                                if item["type"] != "custom_tool_call":
                                    item = {
                                        "id": "fixture-call",
                                        "type": "function_call",
                                        "call_id": "fixture-call",
                                        "name": name.rsplit(".", 1)[-1],
                                        "arguments": json.dumps(args),
                                        **(
                                            {"namespace": name.rsplit(".", 1)[0]}
                                            if "." in name
                                            else {}
                                        ),
                                    }
                            else:
                                report["capability_unavailable"] = leaf
                        if case == "subagent" and parent_requests == 1 and not child:
                            outputs = [
                                json.loads(entry["output"])
                                for entry in body.get("input", [])
                                if entry.get("type") == "function_call_output"
                                and entry.get("call_id") == "fixture-call"
                            ]
                            target = next(
                                (
                                    output.get("agent_id")
                                    for output in outputs
                                    if output.get("agent_id")
                                ),
                                None,
                            )
                            wait_tool = next(
                                (
                                    (name, tool)
                                    for name, tool in tools
                                    if name.rsplit(".", 1)[-1] == "wait_agent"
                                ),
                                None,
                            )
                            if target and wait_tool:
                                child_identity["target"] = target
                                name, _ = wait_tool
                                item = {
                                    "id": "fixture-wait-call",
                                    "type": "function_call",
                                    "call_id": "fixture-wait-call",
                                    "name": name.rsplit(".", 1)[-1],
                                    "namespace": name.rsplit(".", 1)[0],
                                    "arguments": json.dumps(
                                        {"targets": [target], "timeout_ms": 10000}
                                    ),
                                }
                        if case == "subagent" and not child:
                            report["child_completed"] = report.get(
                                "child_completed", False
                            ) or any(
                                completed_child(
                                    entry.get("output", ""), child_identity["target"]
                                )
                                for entry in body.get("input", [])
                                if entry.get("type") == "function_call_output"
                                and entry.get("call_id") == "fixture-wait-call"
                            )
                        if child:
                            item["content"][0]["text"] = "AXIOM_CHILD_COMPLETE"
                        response_id = "fixture-response-" + str(len(state["requests"]))
                        response = {
                            "id": response_id,
                            "object": "response",
                            "status": "completed",
                            "output": [item],
                            "usage": {
                                "input_tokens": 1,
                                "output_tokens": 1,
                                "total_tokens": 2,
                            },
                        }
                        events = [
                            {
                                "type": "response.created",
                                "response": {
                                    "id": response_id,
                                    "object": "response",
                                    "status": "in_progress",
                                    "output": [],
                                },
                            },
                            {
                                "type": "response.output_item.added",
                                "output_index": 0,
                                "item": item,
                            },
                            {
                                "type": "response.output_item.done",
                                "output_index": 0,
                                "item": item,
                            },
                            {"type": "response.completed", "response": response},
                        ]
                        self.send_response(200)
                        self.send_header("Content-Type", "text/event-stream")
                        self.send_header("Connection", "close")
                        self.end_headers()
                        for event in events:
                            self.wfile.write(
                                (
                                    "event: "
                                    + event["type"]
                                    + "\ndata: "
                                    + json.dumps(event)
                                    + "\n\n"
                                ).encode()
                            )
                        self.wfile.flush()
                    except Exception as error:  # noqa: BLE001 - retain sanitized fixture failures
                        state["errors"].append(type(error).__name__)
                        self.send_error(400, "Synthetic fixture provider failure")

            server = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
            server.daemon_threads = True
            server_thread = threading.Thread(target=server.serve_forever, daemon=True)
            server_thread.start()
            cleanup.callback(server_thread.join, timeout=2)
            cleanup.callback(server.server_close)
            cleanup.callback(server.shutdown)
            original = (config / "config.toml").read_text()
            (config / "config.toml").write_text(
                'model_provider="axiom_fixture"\nmodel="axiom-synthetic-fixture"\n[features]\nhooks=true\nmulti_agent=true\n[model_providers.axiom_fixture]\nname="Authored transport without inference"\nbase_url="http://127.0.0.1:'
                + str(server.server_port)
                + '/v1"\nwire_api="responses"\nrequires_openai_auth=false\nrequest_max_retries=0\nstream_max_retries=0\nsupports_websockets=false\n'
                + original
                + '\n[plugins."axiom@axiom-disposable".mcp_servers.axiom]\nenabled=false\n'
            )
            with (root / "runner-stderr").open("wb") as stderr:
                runner = Runner(binary, workspace, env, stderr)
                runner.call(
                    "initialize",
                    {
                        "clientInfo": {
                            "name": "axiom_lifecycle_fixture",
                            "version": "1",
                        },
                        "capabilities": {"experimentalApi": True},
                    },
                )
                runner.send({"method": "initialized"})
                inventory = runner.call("hooks/list", {"cwds": [str(workspace)]})
                hooks = [hook for entry in inventory["data"] for hook in entry["hooks"]]
                report["inventory"] = [
                    {
                        key: hook.get(key)
                        for key in (
                            "eventName",
                            "source",
                            "pluginId",
                            "enabled",
                            "trustStatus",
                            "statusMessage",
                            "timeoutSec",
                        )
                    }
                    for hook in hooks
                ]
                report["checks"]["installed_source_manifest"] = all(
                    Path(h["sourcePath"]) == installed_package / "hooks/hooks.json"
                    for h in hooks
                    if h.get("pluginId") == "axiom@axiom-disposable"
                )
                report["checks"]["installed_plugin_discovered"] = (
                    len(
                        [
                            h
                            for h in hooks
                            if h.get("pluginId") == "axiom@axiom-disposable"
                        ]
                    )
                    == 5
                )
                report["checks"]["isolated_sources"] = all(
                    h["source"] in ("plugin", "user")
                    and (
                        h.get("pluginId") == "axiom@axiom-disposable"
                        or Path(h["sourcePath"]) == config / "hooks.json"
                    )
                    for h in hooks
                )
                if not report["checks"]["isolated_sources"]:
                    raise HarnessError("unexpected_hook_source")
                thread = runner.call(
                    "thread/start",
                    {
                        "model": "axiom-synthetic-fixture",
                        "modelProvider": "axiom_fixture",
                        "cwd": str(workspace),
                        "ephemeral": True,
                        "sandbox": "workspace-write",
                        "approvalPolicy": "never",
                        "config": {"bypass_hook_trust": True},
                    },
                )
                tid = thread["thread"]["id"]
                prompt = PROMPT + (
                    " AXIOM_PARENT_FIXTURE" if case == "subagent" else ""
                )
                if case == "nested-large":
                    prompt += "x" * (1_048_576 - len(prompt.encode()))
                report["input_utf8_bytes"] = len(prompt.encode())
                turn = runner.call(
                    "turn/start",
                    {
                        "threadId": tid,
                        "input": [{"type": "text", "text": prompt}],
                        "model": "axiom-synthetic-fixture",
                    },
                )
                turn_id = turn["turn"]["id"]
                if case == "cancel":
                    runner.until(lambda: (root / "started").exists())
                    runner.call("turn/interrupt", {"threadId": tid, "turnId": turn_id})
                    report["interrupt_acknowledged"] = True
                runner.until(
                    lambda: any(
                        m.get("method") == "turn/completed"
                        and m["params"]["threadId"] == tid
                        for m in runner.messages
                    )
                )
                if case == "subagent" and "capability_unavailable" not in report:
                    runner.until(
                        lambda: any(
                            m.get("method") == "hook/completed"
                            and m["params"]["run"]["eventName"] == "subagentStart"
                            for m in runner.messages
                        )
                    )
        except FileNotFoundError:
            report["harness_error"] = "launch_error"
        except subprocess.TimeoutExpired:
            report["harness_error"] = "setup_timeout"
        except subprocess.CalledProcessError as error:
            report["harness_error"] = "setup_process_exit"
            report["setup_exit_code"] = error.returncode
        except HarnessError as error:
            report["harness_error"] = error.kind
        except Exception as error:  # noqa: BLE001 - retain sanitized fixture failures
            report["harness_error"] = "harness_exception"
            report["exception_class"] = type(error).__name__
        finally:
            if runner:
                runner.close()
                completed = [
                    m["params"]["run"]
                    for m in runner.messages
                    if m.get("method") == "hook/completed"
                ]
                report["hook_started"] = [
                    {
                        key: m["params"]["run"].get(key)
                        for key in ("eventName", "source", "statusMessage")
                    }
                    for m in runner.messages
                    if m.get("method") == "hook/started"
                ]
                report["hook_runs"] = []
                for run in completed:
                    entries = run.get("entries", [])
                    report["hook_runs"].append(
                        {
                            **{
                                key: run.get(key)
                                for key in (
                                    "eventName",
                                    "source",
                                    "status",
                                    "statusMessage",
                                    "durationMs",
                                )
                            },
                            "outcome": classify(run["status"], entries),
                            "entries": [
                                {
                                    "kind": e["kind"],
                                    "utf8_bytes": len(e["text"].encode()),
                                    "sha256": hashlib.sha256(
                                        e["text"].encode()
                                    ).hexdigest(),
                                }
                                for e in entries
                            ],
                        }
                    )
                report["turn_statuses"] = [
                    m["params"]["turn"]["status"]
                    for m in runner.messages
                    if m.get("method") == "turn/completed"
                ]
                report["terminal_exit_codes"] = [
                    m["params"]["item"].get("exitCode")
                    for m in runner.messages
                    if m.get("method") == "item/completed"
                    and m["params"]["item"].get("type") == "commandExecution"
                ]
                report["runtime_errors"] = len(
                    [m for m in runner.messages if m.get("method") == "error"]
                )
                report["terminal_error_present"] = any(
                    m["params"]["turn"].get("error") is not None
                    for m in runner.messages
                    if m.get("method") == "turn/completed"
                )
                production = [r for r in completed if r.get("source") == "plugin"]
                required = (
                    {"sessionStart"}
                    if case == "cancel"
                    else {"sessionStart", "userPromptSubmit"}
                )
                report["checks"]["production_required_events"] = required <= {
                    r["eventName"] for r in production if r["status"] == "completed"
                }
                report["checks"]["production_hooks_succeeded"] = all(
                    r["status"] == "completed" for r in production
                )
                synthetic = [
                    r for r in report["hook_runs"] if r.get("source") == "user"
                ]
                if case in ("timeout", "signal", "exception", "parse", "launch"):
                    expected = {
                        "timeout": "timeout",
                        "signal": "status_missing",
                        "exception": "process_exit",
                        "parse": "parse_error",
                        "launch": "process_exit",
                    }[case]
                    report["checks"]["expected_synthetic_failure"] = any(
                        r["outcome"] == expected for r in synthetic
                    )
                    if case == "signal":
                        report["controlled_signal"] = (
                            "SIGTERM sent by authored fixture to itself; host exposes no raw signal"
                        )
                if case == "cancel":
                    report["checks"][
                        "cancellation_acknowledged_and_turn_interrupted"
                    ] = (
                        report.get("interrupt_acknowledged", False)
                        and "interrupted" in report["turn_statuses"]
                    )
                    report["cancellation_hook_outcomes"] = [
                        r["outcome"] for r in synthetic
                    ]
                    report["checks"]["synthetic_hook_began_before_cancel"] = any(
                        r["statusMessage"] == "Axiom synthetic lifecycle: cancel"
                        for r in report["hook_started"]
                    )
                if case in ("normal", "nested-large"):
                    report["checks"]["terminal_hint_transport_delivery"] = (
                        len(state["requests"]) == 2
                        and not state["requests"][0]["hint_present"]
                        and state["requests"][1]["hint_present"]
                    )
                if case == "edit" and "capability_unavailable" not in report:
                    report["checks"]["edit_dispatch_and_file_created"] = (
                        workspace / "Fixture.swift"
                    ).exists() and any(
                        r["statusMessage"] == "Axiom: PostToolUse Swift guardrails"
                        for r in production
                    )
                if case == "subagent" and "capability_unavailable" not in report:
                    report["checks"]["subagent_dispatch"] = any(
                        r["eventName"] == "subagentStart" for r in production
                    )
                if case == "offload":
                    paths = [
                        Path(match)
                        for text in texts
                        for match in re.findall(
                            r'(/[^\s"\\]+/hook_outputs/[^\s"\\]+\.txt)', text
                        )
                    ]
                    report["checks"]["offloaded_content_verified"] = any(
                        p.is_relative_to(root)
                        and p.is_file()
                        and p.read_text() == OFFLOAD
                        for p in paths
                    )
                    report["checks"]["offload_preview_received"] = any(
                        r["offload_preview"] and not r["offload_full_in_request"]
                        for r in state["requests"]
                    )
                startup = next(
                    (
                        e["text"]
                        for r in production
                        if r["eventName"] == "sessionStart"
                        for e in r["entries"]
                        if e["kind"] == "context"
                    ),
                    "",
                )
                report["startup_utf8_bytes"] = len(startup.encode())
                if case == "cancel":
                    report["checks"]["cancel_before_inference"] = not texts
                else:
                    report["checks"]["startup_complete_transport_delivery"] = bool(
                        texts
                    ) and context_present(startup, texts[0])
            journal = root / "diagnostics/axiom-hooks.jsonl"
            report["diagnostics"] = (
                [json.loads(line) for line in journal.read_text().splitlines()]
                if journal.exists()
                else []
            )
            report["checks"]["production_diagnostic_pairs"] = diagnostics_valid(
                report["diagnostics"],
                [HANDLERS.get(r["statusMessage"]) for r in production],
                [
                    HANDLERS.get(r["statusMessage"])
                    for r in report["hook_started"]
                    if r["source"] == "plugin"
                ],
                case == "cancel",
            )
            if case in ("timeout", "cancel", "signal", "exception", "offload", "parse"):
                synthetic_journal = root / "synthetic-diagnostics/axiom-hooks.jsonl"
                report["synthetic_diagnostics"] = (
                    [
                        json.loads(line)
                        for line in synthetic_journal.read_text().splitlines()
                    ]
                    if synthetic_journal.exists()
                    else []
                )
                report["checks"]["synthetic_diagnostic_start"] = (
                    bool(report["synthetic_diagnostics"])
                    and report["synthetic_diagnostics"][0]["phase"] == "start"
                )
                if case == "exception":
                    report["checks"]["synthetic_exception_diagnostic"] = any(
                        r["phase"] == "end"
                        and r["outcome"] == "exception"
                        and r["exception_class"] == "RuntimeError"
                        for r in report["synthetic_diagnostics"]
                    )
            if case == "subagent":
                contexts = [
                    entry["text"]
                    for run in production
                    if run["eventName"] == "subagentStart"
                    for entry in run.get("entries", [])
                    if entry.get("kind") == "context"
                ]
                for request, serialized in zip(state["requests"], texts):
                    request["subagent_context_complete"] = (
                        request["child"]
                        and bool(contexts)
                        and all(
                            context_present(context, serialized) for context in contexts
                        )
                    )
            report["transport"] = state
            report["checks"]["no_harness_or_provider_errors"] = (
                "harness_error" not in report
                and not state["errors"]
                and report.get("runtime_errors", 0) == 0
            )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run",
        action="store_true",
        required=True,
        help="Opt in to disposable installation and actual-runner transport checks",
    )
    parser.add_argument("--binary", required=True)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--case", choices=(*CASES, "all"), default="all")
    args = parser.parse_args()
    failed = False
    for case in CASES if args.case == "all" else (args.case,):
        report = run_case(args.binary, args.package.resolve(), case)
        path = retain(args.evidence, report)
        print(
            json.dumps(
                {
                    "case": case,
                    "status": report["status"],
                    "report": str(path),
                    "checks": report["checks"],
                    "harness_error": report.get("harness_error"),
                }
            ),
            flush=True,
        )
        failed |= report["status"] != "passed"
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
