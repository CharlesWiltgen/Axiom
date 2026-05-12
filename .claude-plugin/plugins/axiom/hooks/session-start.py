#!/usr/bin/env python3
import json
import sys
import os
from datetime import datetime

if len(sys.argv) < 2:
    print(json.dumps({"error": "Usage: session-start.py <plugin_root>"}), file=sys.stderr)
    sys.exit(1)

plugin_root = sys.argv[1]

# Read using-axiom content
try:
    with open(f"{plugin_root}/skills/axiom-tools/SKILL.md", "r") as f:
        using_axiom_content = f.read()
except Exception as e:
    print(f"[WARN SessionStart] Failed to read axiom-tools skill: {e}", file=sys.stderr)
    using_axiom_content = f"Error reading axiom-tools skill: {e}"

# Platform context - behavioral rules for handling iOS version uncertainty.
# Deliberately does NOT assert the model's training cutoff or list the skipped
# majors (19-25) as "might exist" — both age badly, and the latter actively
# misinforms a model that already knows iOS 26. This is now the *only* place
# Axiom states the iOS-version ground truth; the old reactive Stop hook
# (stop-validation.sh) was retired — it false-blocked on prose that merely
# discussed version-denial phrasings and added nothing a current model needs.
# See GH #39 and axiom-nnue.
current_date = datetime.now().strftime("%A, %Y-%m-%d")
platform_context = f"""## iOS / Xcode VERSION GROUND TRUTH (Current date: {current_date})

iOS 26 is the current major line — Apple went straight from iOS 18 to iOS 26 at
WWDC 2025; the in-between majors (19-25) were never released. Xcode 26 ships with
it. A newer major may have shipped since your training cutoff — don't assume 26 is
still the latest.

BEHAVIORAL RULES:
1. NEVER claim an iOS/Xcode version "doesn't exist" or is "wrong" because it
   postdates your training — that includes iOS 26 and anything above it.
2. NEVER state which iOS/Xcode version is "current" or "latest" from training
   alone — defer to Axiom skills, or check https://support.apple.com/en-us/123075.
3. For iOS-version or new-API questions, invoke the relevant Axiom skill first
   (axiom-apple-docs, axiom-swiftui) — they carry WWDC 2025+ documentation.

This is a behavioral instruction grounded in Apple's release history, not a claim
about your training data."""

# Detect Apple for-LLM documentation in Xcode
xcode_path = os.environ.get("AXIOM_XCODE_PATH", "/Applications/Xcode.app")
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
xclog_context = ""
MIN_XCLOG_SIZE = 1_000_000
try:
    if os.path.isfile(xclog_path):
        xclog_size = os.path.getsize(xclog_path)
        if xclog_size < MIN_XCLOG_SIZE:
            xclog_context = f"""

---

**xclog binary appears truncated** ({xclog_size:,} bytes at `{xclog_path}`; expected ≥{MIN_XCLOG_SIZE:,}). Likely cause: interrupted plugin install or disk-full mid-write. Tell the user to reinstall the Axiom plugin. Do NOT call `xclog` or `/axiom:console` — fall back to `xcrun simctl spawn ... log stream` for any console capture until the user reinstalls."""
        elif os.access(xclog_path, os.X_OK):
            xclog_context = f"""

---

**xclog** (simulator console capture): Available at `{xclog_path}`. Captures print()/os_log()/Logger output as structured JSON. Use `xclog list` to find bundle IDs, `xclog launch <bundle-id> --timeout 30s --max-lines 200` for bounded capture. For crash diagnosis workflow, see `axiom-tools` (skills/xclog-ref.md). Command: `/axiom:console`."""
except OSError:
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
            xcsym_context = f"""

---

**xcsym binary appears truncated** ({xcsym_size:,} bytes at `{xcsym_path}`; expected ≥{MIN_XCSYM_SIZE:,}). Likely cause: interrupted plugin install or disk-full mid-write. Tell the user to reinstall the Axiom plugin. Do NOT call `xcsym` or `/axiom:analyze-crash` — fall back to `atos`/`symbolicatecrash` for any crash analysis until the user reinstalls."""
        elif os.access(xcsym_path, os.X_OK):
            xcsym_context = f"""

---

**xcsym** (crash symbolication): Available at `{xcsym_path}`. Symbolicates .ips, MetricKit, Apple legacy .crash text files, and Xcode Organizer .xccrashpoint bundles with LLM-friendly JSON. Use `xcsym crash <file>` for full triage (point at the bundle directory or the inner .crash), `xcsym verify <file>` for dSYM diagnostics. For crash analysis workflow, see `axiom-tools` (skills/xcsym-ref.md). Command: `/axiom:analyze-crash`."""
except OSError:
    pass

# Build the context message
additional_context = f"""<EXTREMELY_IMPORTANT>
You have Axiom iOS development skills.

{platform_context}

---

**Below is the full content of your 'axiom:axiom-tools' skill - your introduction to using Axiom skills. For all other Axiom skills, use the 'Skill' tool:**

{using_axiom_content}{apple_docs_context}{xclog_context}{xcsym_context}

</EXTREMELY_IMPORTANT>"""

# Output valid JSON (json.dumps handles all escaping correctly)
output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": additional_context
    }
}

print(json.dumps(output))
