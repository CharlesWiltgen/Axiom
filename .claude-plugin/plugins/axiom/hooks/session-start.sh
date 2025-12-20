#!/usr/bin/env bash
# SessionStart hook for Axiom plugin

set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read using-axiom content
using_axiom_content=$(cat "${PLUGIN_ROOT}/skills/using-axiom/SKILL.md" 2>&1 || echo "Error reading using-axiom skill")

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

# Output context injection as JSON
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\nYou have Axiom iOS development skills.\n\n**Below is the full content of your 'axiom:using-axiom' skill - your introduction to using Axiom skills. For all other Axiom skills, use the 'Skill' tool:**\n\n${using_axiom_escaped}\n\n</EXTREMELY_IMPORTANT>"
  }
}
EOF

exit 0
