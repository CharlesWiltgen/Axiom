#!/bin/bash
# Swift Guardrails — PostToolUse hook for Write|Edit on .swift files
# Catches iOS-specific issues as code is written.
#
# Returns JSON with decision:"block" for critical issues (Claude must fix),
# or additionalContext for warnings (Claude sees but isn't forced to act).

FILE_PATH="$TOOL_INPUT_FILE_PATH"

# Only check Swift files
[[ "$FILE_PATH" != *.swift ]] && exit 0

# Only check files that exist (Edit on deleted file edge case)
[[ ! -f "$FILE_PATH" ]] && exit 0

ISSUES=""
CRITICAL=false

# --- CRITICAL: @State var without private ---
# @State without private lets child views create their own source of truth,
# causing silent state bugs that are extremely hard to debug.
if grep -n '@State var ' "$FILE_PATH" | grep -v '@State private var\|@State internal var\|@State fileprivate var\|@State public var\|@State package var\|// *axiom-ignore' > /dev/null 2>&1; then
  LINES=$(grep -n '@State var ' "$FILE_PATH" | grep -v '@State private var\|@State internal var\|@State fileprivate var\|@State public var\|@State package var\|// *axiom-ignore' | head -3)
  ISSUES="${ISSUES}\n⚠️ @State var without access control (should be @State private var):\n${LINES}\n"
  CRITICAL=true
fi

# Output results
if [[ -n "$ISSUES" ]]; then
  ESCAPED_ISSUES=$(echo -e "$ISSUES" | sed 's/"/\\"/g' | tr '\n' ' ')

  if [[ "$CRITICAL" == "true" ]]; then
    cat <<ENDJSON
{
  "decision": "block",
  "reason": "Swift guardrail: @State properties must have an explicit access level (usually private). Without it, child views can create independent copies of the state, causing silent bugs. Fix: change @State var to @State private var.",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "${ESCAPED_ISSUES}"
  }
}
ENDJSON
  fi
fi

exit 0
