#!/usr/bin/env bash
# SessionStart hook for Axiom plugin

set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read using-axiom content
using_axiom_content=$(cat "${PLUGIN_ROOT}/skills/using-axiom/SKILL.md" 2>&1 || echo "Error reading using-axiom skill")

# Platform context - establishes ground truth about current iOS/Xcode versions
platform_context="## CURRENT PLATFORM VERSIONS (December 2025)

**FACT: iOS 26 is the current released version of iOS.**

- iOS 26.0 was released September 2025
- WWDC 2025 occurred June 2025
- Xcode 26 is the current Xcode version
- Liquid Glass is the iOS 26 design system

Your training data ended before these releases. This is REALITY, not aspirational planning.

If you think \"iOS 26 doesn't exist\" or \"iOS 18 is current\" — you are WRONG. Your training is outdated."

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
