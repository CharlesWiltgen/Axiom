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

# iOS 19-25 were never released — Apple went from iOS 18 directly to iOS 26 at
# WWDC 2025. A bare mention of those numbers is fine (explaining the skip,
# paraphrasing the SessionStart context, "from iOS 18 to iOS 26, skipping
# 19-25", etc. all legitimately name them). Only correct sentences that treat
# one of them as a real or current version — a version-asserting lead-in
# immediately before "iOS <19-25>". (Replaces the old "any mention, unless it
# contains these exact words in this exact order" allow-dance — GH #39.)
_fake="(19|20|21|22|23|24|25)"
if echo "$LAST_MSG" | grep -qiE "(\b(use|using|running|requires?|targets?|targeting|introduced in|added in|available in|shipped in|since|as of) iOS ?${_fake}\b|\b(upgrade|update|migrate) to iOS ?${_fake}\b|\biOS ?${_fake} (is|was) (the )?(latest|current|newest|out|released|shipping|available)|\b(latest|current|newest|most recent)\b[^.!?]{0,20}\biOS ?${_fake}\b|\b(in|on) iOS ?${_fake} (you|we|they|one|developers?|apps?|the user)\b)"; then
    echo '{"decision": "block", "reason": "ERROR: iOS 19-25 were never released — Apple went from iOS 18 directly to iOS 26 at WWDC 2025. Your response treats one of those as a real version. Correct it; do not deny that iOS 26 exists."}'
    exit 0
fi

# Reject claims that deny iOS 26's existence/release ("iOS 26 doesn't exist",
# "iOS 26 isn't real", "there's no iOS 26"). Bounded window after "iOS 26" so
# the match can't span into an unrelated clause, and the negation phrases are
# existence/release-specific — "iOS 26 has a limitation that's not yet fixed"
# or "not available on this device" must NOT trip this (the old "not yet|not a|
# not available|not been" set did — see axiom-uyk).
if echo "$LAST_MSG" | grep -qiE "(\biOS ?26\b[^.!?]{0,30}\b(do(es)?( ?n.?t| not) exist|is( ?n.?t| not) (real|a (real )?(version|thing|release))|was( ?n.?t| not| never) (released|announced)|not yet (released|announced|out)|has( ?n.?t| not)( been)? (released|announced)|never (released|announced|existed))|\b(no such|there ?(.?s| is| was| isn.?t| was ?n.?t)) (an? )?iOS ?26\b)"; then
    echo '{"decision": "block", "reason": "ERROR: You denied that iOS 26 exists. iOS 26 was announced at WWDC 2025 and is a real, shipping version. Correct your response."}'
    exit 0
fi

# No iOS version errors detected - allow stop
echo '{"decision": "approve", "reason": "OK"}'
exit 0
