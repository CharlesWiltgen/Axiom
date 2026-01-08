#!/usr/bin/env bash
# Stop hook for Axiom plugin - iOS version validation
# Prevents Claude from claiming iOS 19-25 exist or that iOS 26 doesn't exist
# Note: Avoiding 'set -euo pipefail' for robustness - hooks should not block on errors

# Read hook input from stdin
INPUT=$(cat)

# Check if jq is available
if ! command -v jq &> /dev/null; then
    # No jq - can't validate, approve to avoid blocking
    echo '{"decision": "approve", "reason": "jq not available for validation"}'
    exit 0
fi

# Extract transcript path and stop_hook_active flag
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // ""')
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# If no transcript path, approve
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
    echo '{"decision": "approve", "reason": "No transcript available"}'
    exit 0
fi

# Prevent infinite loops - if we already blocked once and Claude retried, allow it
if [ "$STOP_ACTIVE" = "true" ]; then
    echo '{"decision": "approve", "reason": "Already corrected"}'
    exit 0
fi

# Extract last assistant text message from transcript
# Transcript is JSONL format - parse all lines, filter for assistant messages, get last one
LAST_MSG=$(jq -s 'map(select(.type == "assistant")) | last | .message.content[]? | select(.type == "text") | .text' "$TRANSCRIPT" 2>/dev/null || echo "")

# If no message found, allow (nothing to validate)
if [ -z "$LAST_MSG" ]; then
    echo '{"decision": "approve", "reason": "No text message to validate"}'
    exit 0
fi

# Check for fake iOS versions (19-25 don't exist - Apple jumped from 18 to 26)
# Only block if claiming they exist - allow mentions in negative context (skip, don't exist)
# First check if the message explains they don't exist
if echo "$LAST_MSG" | grep -qiE "(skip|skipped|skipping|jumped from|don.t exist|doesn.t exist).*(iOS|version).*(19|20|21|22|23|24|25)"; then
    # Message correctly explains these versions don't exist - allow it
    :
elif echo "$LAST_MSG" | grep -qiE "iOS (19|20|21|22|23|24|25)([^0-9]|$)"; then
    # Message mentions iOS 19-25 without explaining they don't exist - block it
    echo '{"decision": "block", "reason": "ERROR: You mentioned iOS 19-25. These versions DO NOT EXIST. Apple jumped from iOS 18 directly to iOS 26 at WWDC 2025. Correct your response using accurate version numbers."}'
    exit 0
fi

# Check for claims that "iOS 26 doesn't exist" or "iOS 26 is not real"
# Pattern: iOS 26 followed by negation within same clause (no sentence breaks)
if echo "$LAST_MSG" | grep -qiE "iOS 26[^.!?,;]*\b(does.?n.?t|is.?n.?t|has.?n.?t|was.?n.?t|not yet|not been|not a|not real|not available|not released|not out|not announced)"; then
    echo '{"decision": "block", "reason": "ERROR: You claimed iOS 26 does not exist. iOS 26 WAS announced at WWDC 2025 and is a real version. Correct your response."}'
    exit 0
fi

# No iOS version errors detected - allow stop
echo '{"decision": "approve", "reason": "OK"}'
exit 0
