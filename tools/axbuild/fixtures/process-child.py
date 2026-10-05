#!/usr/bin/python3
import json
import os
import signal
import subprocess
import sys
import time

args = sys.argv[1:]
name = os.path.basename(sys.argv[0])
if name == "swift" and args == ["--version"]:
    print(
        os.environ.get(
            "FIXTURE_VERSION",
            "Apple Swift version 6.4 (swiftlang-6.4.0.34.1 clang-2100.3.34.1)",
        )
    )
    sys.exit(0)
if name == "swift" and "--help-hidden" in args:
    print("--no-color-diagnostics --event-stream-output-path --event-stream-version")
    sys.exit(0)
if any(a in args for a in ["--help", "-help", "-list"]):
    print("native informational stdout")
    print("native informational stderr", file=sys.stderr)
    sys.exit(12)
if name == "xcrun":
    if os.environ.get("FIXTURE_XCRUN_RECORD"):
        with open(os.environ["FIXTURE_XCRUN_RECORD"], "a") as f:
            f.write(json.dumps(args) + "\n")
    while args and args[0].startswith("-"):
        args = args[2:] if args[0] in ["--sdk", "--toolchain"] else args[1:]
    tool, args = args[0], args[1:]
    os.execv(os.path.join(os.path.dirname(sys.argv[0]), tool), [tool] + args)
if name == "xcresulttool":
    if os.environ.get("FIXTURE_AUX_RECORD"):
        with open(os.environ["FIXTURE_AUX_RECORD"], "w") as f:
            json.dump({"args": args, "value": os.environ.get("FIXTURE_VALUE")}, f)
    if os.environ.get("FIXTURE_AUX_HANG"):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        if os.environ.get("FIXTURE_AUX_READY"):
            with open(os.environ["FIXTURE_AUX_READY"] + ".tmp", "w") as f:
                f.write(str(os.getpid()))
            os.replace(
                os.environ["FIXTURE_AUX_READY"] + ".tmp",
                os.environ["FIXTURE_AUX_READY"],
            )
        while True:
            time.sleep(0.1)
    print(os.environ.get("FIXTURE_RESULTS", '{"testNodes":[]}'))
    sys.exit(0)
if "FIXTURE_RECORD" in os.environ:
    with open(os.environ["FIXTURE_RECORD"], "w") as f:
        json.dump(
            {
                "args": args,
                "cwd": os.getcwd(),
                "value": os.environ.get("FIXTURE_VALUE"),
                "pid": os.getpid(),
                "pgrp": os.getpgrp(),
            },
            f,
        )
if os.environ.get("FIXTURE_RESULT") == "create":
    if "-resultBundlePath" in args:
        os.makedirs(args[args.index("-resultBundlePath") + 1], exist_ok=True)
if os.environ.get("FIXTURE_EVENTS") and "--event-stream-output-path" in args:
    with open(args[args.index("--event-stream-output-path") + 1], "w") as f:
        f.write(os.environ["FIXTURE_EVENTS"])
if os.environ.get("FIXTURE_SELF_SIGNAL"):
    os.kill(os.getpid(), int(os.environ["FIXTURE_SELF_SIGNAL"]))
if os.environ.get("FIXTURE_MODE") == "trap":
    os.write(
        1,
        b"Test Suite 'All tests' started at 2026-10-04 16:05:06.095.\nCalc.swift:5: Fatal error: boom\n",
    )
    sys.exit(65)
if os.environ.get("FIXTURE_MODE") == "linger":
    child = subprocess.Popen(
        ["/usr/bin/python3", "-c", "import time; time.sleep(300)"],
        preexec_fn=lambda: signal.signal(signal.SIGTERM, signal.SIG_IGN),
    )
    os.write(1, b"A.swift:3:7: error: fixture error\n")
    with open(os.environ["FIXTURE_READY"] + ".tmp", "w") as f:
        json.dump({"pid": os.getpid(), "grandchild": child.pid}, f)
    os.replace(os.environ["FIXTURE_READY"] + ".tmp", os.environ["FIXTURE_READY"])
    sys.exit(65)
if os.environ.get("FIXTURE_MODE") == "hang":
    child = subprocess.Popen(
        ["/usr/bin/python3", "-c", "import time; time.sleep(300)"],
        preexec_fn=(
            (lambda: signal.signal(signal.SIGTERM, signal.SIG_IGN))
            if os.environ.get("FIXTURE_GRANDCHILD_IGNORE_TERM")
            else None
        ),
    )
    if os.environ.get("FIXTURE_IGNORE_TERM"):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
    if os.environ.get("FIXTURE_SIGNAL_EXIT"):
        for sig in [signal.SIGINT, signal.SIGTERM, signal.SIGHUP]:
            signal.signal(sig, lambda *_: sys.exit(7))
    os.write(
        1,
        b"A.swift:3:7: error: emitted before interruption\npartial output before interruption\n",
    )
    with open(os.environ["FIXTURE_READY"] + ".tmp", "w") as f:
        json.dump({"pid": os.getpid(), "grandchild": child.pid}, f)
    os.replace(os.environ["FIXTURE_READY"] + ".tmp", os.environ["FIXTURE_READY"])
    while True:
        time.sleep(0.1)
os.write(1, b"A.swift:3:7: error: fixture error\r\n")
os.write(2, b"raw stderr \xff\n")
sys.exit(int(os.environ.get("FIXTURE_EXIT", "65")))
