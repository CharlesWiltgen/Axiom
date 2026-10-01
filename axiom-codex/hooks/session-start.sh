#!/usr/bin/env bash
# SessionStart hook for Axiom plugin
# Note: Avoiding 'set -euo pipefail' for robustness - hooks should not block Claude Code startup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Use separate Python script to avoid heredoc pipe buffer deadlock on Homebrew bash
# (macOS pipe buffer is 512 bytes; inline heredoc exceeded it — see CharlesWiltgen/Axiom#24)
if [[ ! -f "${SCRIPT_DIR}/session-start.py" ]]; then
    echo "[ERROR SessionStart] session-start.py not found at ${SCRIPT_DIR} — incomplete Axiom install?" >&2
    echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Axiom hook failed to initialize: session-start.py missing. Try reinstalling the plugin."}}'
    exit 0
fi

python3 "${SCRIPT_DIR}/session-start.py" "$PLUGIN_ROOT"
rc=$?
if [[ $rc -ne 0 ]]; then
    echo "[WARN SessionStart] Python script failed (exit $rc)" >&2
    if [[ "${AXIOM_HARNESS:-}" == "codex" ]]; then
        echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Axiom hook failed to initialize. Read relevant local skills/<router>/SKILL.md under the Axiom plugin root using available file or terminal tools, then follow its child guidance. Available Axiom MCP retrieval tools are another loading path."}}'
    else
        echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Axiom hook failed to initialize. Skills are still available via the Skill tool."}}'
    fi
fi

exit 0
