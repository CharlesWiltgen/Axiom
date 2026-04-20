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

# Platform context - behavioral rules for handling iOS version uncertainty
current_date = datetime.now().strftime("%A, %Y-%m-%d")
platform_context = f"""## iOS VERSION UNCERTAINTY (Current date: {current_date})

Your training ended January 2025 (iOS 18 was current then).
iOS 19, 20, 21, 22, 23, 24, 25, 26+ may exist now - you simply don't know.

BEHAVIORAL RULES (not factual claims):
1. NEVER claim an iOS version "doesn't exist" or is "wrong"
2. NEVER assert what the "current" iOS version is based on your training
3. For iOS version questions: Invoke Axiom skills (axiom-swiftui, axiom-apple-docs) which contain WWDC 2025 documentation
4. Defer to Axiom skills for post-cutoff iOS/Xcode facts
5. If Axiom skills don't have the answer, use web search with https://support.apple.com/en-us/123075

This is a BEHAVIORAL INSTRUCTION, not a factual claim."""

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

**Apple for-LLM Documentation**: Xcode detected with {guide_count} guides + {diag_count} Swift diagnostics. Use `axiom-apple-docs` router for authoritative Apple API references."""

# Detect xclog binary
xclog_path = f"{plugin_root}/bin/xclog"
xclog_context = ""
if os.path.isfile(xclog_path) and os.access(xclog_path, os.X_OK):
    xclog_context = f"""

---

**xclog** (simulator console capture): Available at `{xclog_path}`. Captures print()/os_log()/Logger output as structured JSON. Use `xclog list` to find bundle IDs, `xclog launch <bundle-id> --timeout 30s --max-lines 200` for bounded capture. For crash diagnosis workflow, see `axiom-tools` (skills/xclog-ref.md). Command: `/axiom:console`."""

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

**xcsym** (crash symbolication): Available at `{xcsym_path}`. Symbolicates .ips and MetricKit crashes with LLM-friendly JSON. Use `xcsym crash <file>` for full triage, `xcsym verify <file>` for dSYM diagnostics. For crash analysis workflow, see `axiom-tools` (skills/xcsym-ref.md). Command: `/axiom:analyze-crash`."""
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
