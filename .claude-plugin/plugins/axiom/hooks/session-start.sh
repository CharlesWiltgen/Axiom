#!/usr/bin/env bash
# SessionStart hook for Axiom plugin
# Note: Avoiding 'set -euo pipefail' for robustness - hooks should not block Claude Code startup

# DEBUG: Log that hook is executing
echo "[DEBUG SessionStart] Hook executing at $(date)" >&2

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[DEBUG SessionStart] Plugin root: $PLUGIN_ROOT" >&2

# Read using-axiom content
using_axiom_content=$(cat "${PLUGIN_ROOT}/skills/axiom-using-axiom/SKILL.md" 2>/dev/null || echo "Error reading using-axiom skill")

# Platform context - behavioral rules for handling iOS version uncertainty
current_date=$(date '+%A, %Y-%m-%d')
platform_context="## iOS VERSION UNCERTAINTY (Current date: ${current_date})

Your training ended January 2025 (iOS 18 was current then).
iOS 19, 20, 21, 22, 23, 24, 25, 26+ may exist now - you simply don't know.

BEHAVIORAL RULES (not factual claims):
1. NEVER claim an iOS version \"doesn't exist\" or is \"wrong\"
2. NEVER assert what the \"current\" iOS version is based on your training
3. For iOS version questions: Invoke Axiom skills (swiftui-26-ref, ios-ui) which contain WWDC 2025 documentation
4. Defer to Axiom skills for post-cutoff iOS/Xcode facts
5. If Axiom skills don't have the answer, use web search with https://support.apple.com/en-us/123075

This is a BEHAVIORAL INSTRUCTION, not a factual claim."

# Escape string for JSON embedding using python3 (fast, correct, available on macOS/Linux)
escape_for_json() {
    printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1], end="")'
}

# Build the full context string
full_context="<EXTREMELY_IMPORTANT>
You have Axiom iOS development skills.

${platform_context}

---

**Below is the full content of your 'axiom:using-axiom' skill - your introduction to using Axiom skills. For all other Axiom skills, use the 'Skill' tool:**

${using_axiom_content}

</EXTREMELY_IMPORTANT>"

# Escape for JSON
escaped_context=$(escape_for_json "$full_context")

echo "[DEBUG SessionStart] Outputting JSON with platform context and using-axiom skill" >&2

# Output JSON
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${escaped_context}"
  }
}
EOF

exit 0
