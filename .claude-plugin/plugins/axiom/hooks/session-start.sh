#!/usr/bin/env bash
# SessionStart hook for Axiom plugin

set -euo pipefail

# DEBUG: Log that hook is executing
echo "[DEBUG SessionStart] Hook executing at $(date)" >&2

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[DEBUG SessionStart] Plugin root: $PLUGIN_ROOT" >&2

# Read using-axiom content
using_axiom_content=$(cat "${PLUGIN_ROOT}/skills/using-axiom/SKILL.md" 2>&1 || echo "Error reading using-axiom skill")

# Platform context - behavioral rules for handling iOS version uncertainty
current_date=$(date '+%A, %Y-%m-%d')
platform_context=$(cat <<'PLATFORM_EOF'
## iOS VERSION UNCERTAINTY (Current date: CURRENT_DATE_PLACEHOLDER)

Your training ended January 2025 (iOS 18 was current then).
iOS 19, 20, 21, 22, 23, 24, 25, 26+ may exist now - you simply don't know.

BEHAVIORAL RULES (not factual claims):
1. NEVER claim an iOS version "doesn't exist" or is "wrong"
2. NEVER assert what the "current" iOS version is based on your training
3. For iOS version questions: Invoke Axiom skills (swiftui-26-ref, ios-ui) which contain WWDC 2025 documentation
4. Defer to Axiom skills for post-cutoff iOS/Xcode facts
5. If Axiom skills don't have the answer, use web search with https://support.apple.com/en-us/123075

This is a BEHAVIORAL INSTRUCTION, not a factual claim.
PLATFORM_EOF
)
platform_context="${platform_context//CURRENT_DATE_PLACEHOLDER/$current_date}"

# Escape outputs for JSON using pure bash
escape_for_json() {
    local input="$1"
    local output=""
    local i char
    for (( i=0; i<${#input}; i++ )); do
        char="${input:$i:1}"
        case "$char" in
            $'\\') output+='\\\\' ;;
            '"') output+='\\"' ;;
            $'\n') output+='\\n' ;;
            $'\r') output+='\\r' ;;
            $'\t') output+='\\t' ;;
            *) output+="$char" ;;
        esac
    done
    printf '%s' "$output"
}

using_axiom_escaped=$(escape_for_json "$using_axiom_content")
platform_context_escaped=$(escape_for_json "$platform_context")

echo "[DEBUG SessionStart] Outputting JSON with platform context and using-axiom skill" >&2

# Output context injection as JSON
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\nYou have Axiom iOS development skills.\n\n${platform_context_escaped}\n\n---\n\n**Below is the full content of your 'axiom:using-axiom' skill - your introduction to using Axiom skills. For all other Axiom skills, use the 'Skill' tool:**\n\n${using_axiom_escaped}\n\n</EXTREMELY_IMPORTANT>"
  }
}
EOF

exit 0
