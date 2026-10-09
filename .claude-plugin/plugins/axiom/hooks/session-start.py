#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import os
from datetime import datetime

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

hook_diagnostics.begin("session-start")

from project_detect import resolve_context_decision

if len(sys.argv) < 2:
    print(json.dumps({"error": "Usage: session-start.py <plugin_root>"}), file=sys.stderr)
    hook_diagnostics.record_exit(1)
    sys.exit(1)

plugin_root = sys.argv[1]

# Project-type gate (GH #45): in non-Apple projects, skip the context injection
# entirely (emit an empty SessionStart response). resolve_context_decision is
# fail-open — it returns True (inject) on any detection error — so this can never
# silently disable Axiom in a real Apple project. Override: AXIOM_SESSION_CONTEXT.
if not resolve_context_decision(os.getcwd(), os.environ.get("AXIOM_SESSION_CONTEXT")):
    print(json.dumps({}))
    sys.exit(0)

# The Xcode the user has switched to, and its versions, read from plists (no
# xcodebuild subprocess at startup). Every harness states the same version ground
# truth, rendered by version_context.py; see xcode_path.py for the precedence.
# Imported after the gate and guarded: a partial install loses only this block,
# never the gate or the rest of the context.
xcode_path = "/Applications/Xcode.app"
attribution = ""
platform_context = ""
try:
    import version_context
    from xcode_path import detect_toolchain

    toolchain = detect_toolchain(os.environ)
    xcode_path = toolchain.path
    attribution = version_context.ATTRIBUTION
    platform_context = version_context.version_ground_truth(
        version_context.format_date(datetime.now()), toolchain
    )
except Exception as error:
    hook_diagnostics.record_exception(error)
    print(f"[WARN SessionStart] Version context unavailable: {error}", file=sys.stderr)

if os.environ.get("AXIOM_HARNESS") == "codex":
    # Name what this install actually ships, so a new helper is never left out.
    try:
        helpers = ", ".join(
            sorted(n for n in os.listdir(os.path.join(plugin_root, "bin")) if not n.startswith("."))
        )
    except OSError:
        helpers = "none found"
    context = f"""<EXTREMELY_IMPORTANT>
Axiom provides Apple-platform development guidance. For any iOS/Swift task, read
all applicable Axiom routers BEFORE responding or acting, including clarifications.
Load `{plugin_root}/skills/<router>/SKILL.md` with file or terminal tools available
in this session, then follow its referenced child guidance. If Axiom MCP retrieval
tools are available, they are another loading path. Read relevant sections on demand.
Never assume a tool named Skill or Read exists. Report unavailable guidance clearly.

Start with environment/build guidance for build failures, architecture guidance for
UI, data or concurrency work, then implementation guidance. Multi-domain work needs
all relevant routers. Preserve the checks and safeguards in the loaded procedures.
{attribution}

Use only capabilities exposed by this session. Load auditor procedures as skills;
execute them sequentially when collaboration is unavailable. If collaboration tools
are present, respect their documented concurrency limits and the requested model.
Resolve helper paths under `{plugin_root}/bin/` ({helpers}), checking
existence, executable permission and a non-mutating help/version probe before use.
Do not assume helpers are on PATH. Optional Xcode/MCP capabilities need detection.

{platform_context}
</EXTREMELY_IMPORTANT>"""
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "SessionStart", "additionalContext": context,
    }}))
    sys.exit(0)

# Claude Code keeps a hook's additionalContext inline only up to 10,000 chars.
# Past that it saves the text to a file and the model sees a 2,000-char preview
# (https://code.claude.com/docs/en/hooks). So this hook injects only the always-on
# span of axiom-tools/SKILL.md, not the whole file; the routing table, Device Hub
# notes and tool references stay in the skill, which loads on demand.
# session-start_test.py holds the worst-case output under the limit.
SESSION_START_BEGIN = "<!-- AXIOM_SESSION_START_BEGIN"
SESSION_START_END = "<!-- AXIOM_SESSION_START_END -->"


def session_start_span(skill_text: str) -> str:
    """The text between the AXIOM_SESSION_START markers, or the whole skill if
    they are missing, misordered or enclose nothing, so a broken marker can
    only make the output bigger."""
    begin = skill_text.find(SESSION_START_BEGIN)
    nl = skill_text.find("\n", begin) if begin != -1 else -1
    end = skill_text.find(SESSION_START_END, nl) if nl != -1 else -1
    span = skill_text[nl + 1:end].strip() if end != -1 else ""
    return span or skill_text


# Read the always-on part of axiom-tools
try:
    with open(f"{plugin_root}/skills/axiom-tools/SKILL.md", "r", encoding="utf-8") as f:
        using_axiom_content = session_start_span(f.read())
except Exception as e:
    hook_diagnostics.record_exception(e)
    print(f"[WARN SessionStart] Failed to read axiom-tools skill: {e}", file=sys.stderr)
    using_axiom_content = f"Error reading axiom-tools skill: {e}"


# Detect Apple for-LLM documentation in the resolved Xcode (set above)
apple_docs_path = f"{xcode_path}/Contents/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation"
diagnostics_path = f"{xcode_path}/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/share/doc/swift/diagnostics"

apple_docs_context = ""
guide_count = 0
diag_count = 0
if os.path.isdir(apple_docs_path):
    guide_count = len([f for f in os.listdir(apple_docs_path) if f.endswith('.md')])
if os.path.isdir(diagnostics_path):
    diag_count = len([f for f in os.listdir(diagnostics_path) if f.endswith('.md')])

if guide_count > 0 or diag_count > 0:
    apple_docs_context = f"""

---

**Apple for-LLM Documentation**: Xcode detected at `{xcode_path}` with {guide_count} guides + {diag_count} Swift diagnostics. Read guides from `{apple_docs_path}/` and diagnostics from `{diagnostics_path}/` using the `Read` tool. Use `axiom-apple-docs` router for the topic→filename map."""

# Detect xclog binary. Same size-floor logic as the xcsym block below
# (axiom-9w0, parallel to axiom-1kn): plugin marketplace downloads can
# truncate, leaving an executable bit on a partial binary that produces
# opaque "exec format error" / segfault on first call. xclog ships as a
# ~4 MB universal binary; 1 MB is well below any plausible legitimate
# size and well above what truncation produces.
xclog_path = f"{plugin_root}/bin/xclog"
truncated_tools = set()  # flagged below; left out of the bundled-tool roster
xclog_context = ""
MIN_XCLOG_SIZE = 1_000_000
try:
    if os.path.isfile(xclog_path):
        xclog_size = os.path.getsize(xclog_path)
        if xclog_size < MIN_XCLOG_SIZE:
            truncated_tools.add("xclog")
            xclog_context = f"""

---

**xclog binary appears truncated** ({xclog_size:,} bytes at `{xclog_path}`; expected ≥{MIN_XCLOG_SIZE:,}). Likely cause: interrupted plugin install or disk-full mid-write. Tell the user to reinstall the Axiom plugin. Do NOT call `xclog` or `/axiom:console` — fall back to `xcrun simctl spawn ... log stream` for any console capture until the user reinstalls."""
        elif os.access(xclog_path, os.X_OK):
            xclog_context = f"""

---

**xclog** (simulator console capture as structured JSON): Available at `{xclog_path}`. Use `xclog list` to find bundle IDs, `xclog launch <bundle-id> --timeout 30s --max-lines 200` for bounded capture. Command: `/axiom:console`. Usage: `axiom-tools` (skills/xclog-ref.md)."""
except OSError as error:
    hook_diagnostics.record_exception(error)
    pass

# Detect xcsym binary. The size floor (axiom-1kn) catches marketplace-
# download truncation that os.access(X_OK) misses: a partially-written
# binary keeps the executable bit but produces "exec format error" /
# segfault on first call, leaving the agent confused about why a tool
# the hook just announced doesn't actually work. xcsym ships as a
# ~8.5 MB universal binary; 1 MB is comfortably below any plausible
# legitimate size and well above what an interrupted download or
# disk-full mid-write produces. Codesign failures and arch mismatches
# aren't caught — both are vanishingly rare with build-signed universal
# distribution and would warrant a full subprocess probe instead.
xcsym_path = f"{plugin_root}/bin/xcsym"
xcsym_context = ""
MIN_XCSYM_SIZE = 1_000_000
# Wrap the probe in OSError handling — a filesystem error here would
# otherwise propagate and crash the entire hook, dropping the much more
# valuable axiom-tools / platform-rules context with it. Silent skip on
# probe failure matches the missing-binary branch.
try:
    if os.path.isfile(xcsym_path):
        xcsym_size = os.path.getsize(xcsym_path)
        if xcsym_size < MIN_XCSYM_SIZE:
            truncated_tools.add("xcsym")
            xcsym_context = f"""

---

**xcsym binary appears truncated** ({xcsym_size:,} bytes at `{xcsym_path}`; expected ≥{MIN_XCSYM_SIZE:,}). Likely cause: interrupted plugin install or disk-full mid-write. Tell the user to reinstall the Axiom plugin. Do NOT call `xcsym` or `/axiom:analyze-crash` — fall back to `atos`/`symbolicatecrash` for any crash analysis until the user reinstalls."""
        elif os.access(xcsym_path, os.X_OK):
            xcsym_context = f"""

---

**xcsym** (crash symbolication for .ips, MetricKit, .crash and .xccrashpoint): Available at `{xcsym_path}`. Use `xcsym crash <file>` for full triage (point at the bundle directory or the inner .crash), `xcsym verify <file>` for dSYM diagnostics. Command: `/axiom:analyze-crash`. Usage: `axiom-tools` (skills/xcsym-ref.md)."""
except OSError as error:
    hook_diagnostics.record_exception(error)
    pass

# Detect xcui binary. Same size-floor logic as xclog/xcsym (truncated
# marketplace downloads keep the exec bit but fault on first call). xcui
# ships as a multi-MB universal binary; 1 MB is well below legitimate size.
xcui_path = f"{plugin_root}/bin/xcui"
xcui_context = ""
MIN_XCUI_SIZE = 1_000_000
try:
    if os.path.isfile(xcui_path):
        xcui_size = os.path.getsize(xcui_path)
        if xcui_size < MIN_XCUI_SIZE:
            truncated_tools.add("xcui")
            xcui_context = f"""

---

**xcui binary appears truncated** ({xcui_size:,} bytes at `{xcui_path}`; expected ≥{MIN_XCUI_SIZE:,}). Likely cause: interrupted plugin install. Tell the user to reinstall the Axiom plugin. Do NOT call `xcui` or `/axiom:ui` until reinstalled."""
        elif os.access(xcui_path, os.X_OK):
            xcui_context = f"""

---

**xcui** (scriptable sim UI & accessibility testing): Available at `{xcui_path}`. Run `xcui doctor` first. Tap with `xcui tap --id <id>`; bare `axe tap` needs `--tap-style physical`, or SwiftUI controls ignore it while it still reports success. Command: `/axiom:ui`. Usage: `axiom-tools` (skills/xcui-ref.md)."""
except OSError as error:
    hook_diagnostics.record_exception(error)
    pass

# Detect xcprof binary. Same size-floor logic as the other bundled tools.
xcprof_path = f"{plugin_root}/bin/xcprof"
xcprof_context = ""
MIN_XCPROF_SIZE = 1_000_000
try:
    if os.path.isfile(xcprof_path):
        xcprof_size = os.path.getsize(xcprof_path)
        if xcprof_size < MIN_XCPROF_SIZE:
            truncated_tools.add("xcprof")
            xcprof_context = f"""

---

**xcprof binary appears truncated** ({xcprof_size:,} bytes at `{xcprof_path}`; expected ≥{MIN_XCPROF_SIZE:,}). Likely cause: interrupted plugin install. Tell the user to reinstall the Axiom plugin. Do NOT call `xcprof` — fall back to `xcrun xctrace export` + manual XML parsing until the user reinstalls."""
        elif os.access(xcprof_path, os.X_OK):
            xcprof_context = f"""

---

**xcprof** (structured xctrace capture + analysis): Available at `{xcprof_path}`. Run `xcprof doctor` first; the verbs are `record`, `analyze` and `compare`. Usage: `axiom-tools` (skills/xcprof-ref.md), `axiom-performance` (skills/trace-comparison.md)."""
except OSError as error:
    hook_diagnostics.record_exception(error)
    pass

# Bundled tool roster, derived from bin/ at run time so a new tool cannot be
# left out of the session facts. Names only — the lines above carry paths and
# usage; the roster exists so the model knows every tool that ships. A tool
# flagged as truncated above is left out: the roster says to run each with --help.
try:
    bundled_tools = sorted(
        n for n in os.listdir(os.path.join(plugin_root, "bin"))
        if not n.startswith(".") and n not in truncated_tools
    )
except OSError:
    bundled_tools = []

tool_roster_context = ""
if bundled_tools:
    tool_roster_context = f"""

---

**Bundled tools**: {", ".join(bundled_tools)} — run any with `--help`; see `axiom-tools` for usage."""

# Build the context message. The facts only this hook knows (the platform rules,
# installed toolchain and tool paths) come first. If a future change pushes the
# total past Claude Code's inline limit, the preview then starts with them, not
# with skill text the model can load on its own.
additional_context = f"""<EXTREMELY_IMPORTANT>
You have Axiom iOS development skills.

{platform_context}{apple_docs_context}{xclog_context}{xcsym_context}{xcui_context}{xcprof_context}{tool_roster_context}

---

**Below is the always-on part of your 'axiom:axiom-tools' skill. Its routing table, Device Hub notes and tool references load with the 'Skill' tool, as do all other Axiom skills:**

{using_axiom_content}

</EXTREMELY_IMPORTANT>"""

# Output valid JSON (json.dumps handles all escaping correctly)
output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": additional_context
    }
}

print(json.dumps(output))
