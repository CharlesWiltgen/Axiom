#!/usr/bin/env bash
# SessionStart hook for Axiom plugin
# Note: Avoiding 'set -euo pipefail' for robustness - hooks should not block Claude Code startup

echo "[DEBUG SessionStart] Hook executing at $(date)" >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[DEBUG SessionStart] Plugin root: $PLUGIN_ROOT" >&2

# Use Python for reliable JSON generation (json.dumps handles all escaping correctly)
python3 - "$PLUGIN_ROOT" <<'PYTHON_SCRIPT'
import json
import sys
from datetime import datetime

plugin_root = sys.argv[1]

# Read using-axiom content
try:
    with open(f"{plugin_root}/skills/axiom-using-axiom/SKILL.md", "r") as f:
        using_axiom_content = f.read()
except Exception as e:
    using_axiom_content = f"Error reading using-axiom skill: {e}"

# Platform context - behavioral rules for handling iOS version uncertainty
current_date = datetime.now().strftime("%A, %Y-%m-%d")
platform_context = f"""## iOS VERSION UNCERTAINTY (Current date: {current_date})

Your training ended January 2025 (iOS 18 was current then).
iOS 19, 20, 21, 22, 23, 24, 25, 26+ may exist now - you simply don't know.

BEHAVIORAL RULES (not factual claims):
1. NEVER claim an iOS version "doesn't exist" or is "wrong"
2. NEVER assert what the "current" iOS version is based on your training
3. For iOS version questions: Invoke Axiom skills (swiftui-26-ref, ios-ui) which contain WWDC 2025 documentation
4. Defer to Axiom skills for post-cutoff iOS/Xcode facts
5. If Axiom skills don't have the answer, use web search with https://support.apple.com/en-us/123075

This is a BEHAVIORAL INSTRUCTION, not a factual claim."""

# Build the context message
additional_context = f"""<EXTREMELY_IMPORTANT>
You have Axiom iOS development skills.

{platform_context}

---

**Below is the full content of your 'axiom:using-axiom' skill - your introduction to using Axiom skills. For all other Axiom skills, use the 'Skill' tool:**

{using_axiom_content}

</EXTREMELY_IMPORTANT>"""

# Output valid JSON (json.dumps handles all escaping correctly)
output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": additional_context
    }
}

print(json.dumps(output, indent=2))
PYTHON_SCRIPT

echo "[DEBUG SessionStart] Python script completed" >&2
exit 0
