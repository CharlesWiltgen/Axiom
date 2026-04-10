#!/usr/bin/env bash
# SessionStart hook for Axiom plugin
# Note: Avoiding 'set -euo pipefail' for robustness - hooks should not block Claude Code startup

echo "[DEBUG SessionStart] Hook executing at $(date)" >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[DEBUG SessionStart] Plugin root: $PLUGIN_ROOT" >&2

# Use separate Python script to avoid heredoc pipe buffer deadlock on Homebrew bash
# (macOS pipe buffer is 512 bytes; inline heredoc exceeded it — see GitHub #24)
if [[ ! -f "${SCRIPT_DIR}/session-start.py" ]]; then
    echo "[ERROR SessionStart] session-start.py not found at ${SCRIPT_DIR} — incomplete Axiom install?" >&2
    echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Axiom hook failed to initialize: session-start.py missing. Try reinstalling the plugin."}}'
    exit 0
fi

python3 "${SCRIPT_DIR}/session-start.py" "$PLUGIN_ROOT" || {
    echo "[WARN SessionStart] Python script failed (exit $?)" >&2
    echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Axiom hook failed to initialize. Skills are still available via the Skill tool."}}'
}

echo "[DEBUG SessionStart] Hook completed" >&2
exit 0
