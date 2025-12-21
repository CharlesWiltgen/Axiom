#!/usr/bin/env bash
# UserPromptSubmit hook for Axiom plugin
# Detects iOS version questions and forces Axiom skill invocation

set -euo pipefail

# Read input JSON from stdin
input_json=$(cat)

# Extract prompt (using jq if available, fallback to grep/sed)
if command -v jq &> /dev/null; then
  prompt=$(echo "$input_json" | jq -r '.prompt // ""')
else
  # Fallback: extract prompt with grep/sed
  prompt=$(echo "$input_json" | grep -o '"prompt":"[^"]*"' | sed 's/"prompt":"//;s/"$//' || echo "")
fi

# Detect iOS version questions or hallucinated version numbers
# Matches: iOS 19-26, "does iOS exist", "current iOS", "which iOS", "what iOS version"
if echo "$prompt" | grep -qiE "(iOS (19|20|21|22|23|24|25|26)|does.*iOS.*exist|current.*iOS|which iOS|what.*iOS.*version)"; then
  # Force Axiom skill invocation FIRST
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "CRITICAL: This question involves iOS version numbers. Your training ended January 2025 (iOS 18 was current). BEFORE answering, you MUST invoke Axiom's swiftui-26-ref or ios-ui skill to get current iOS information. These skills contain authoritative WWDC 2025 and iOS 26 documentation. DO NOT answer from your training data alone."
  }
}
EOF
else
  # No iOS version question detected - return empty JSON
  echo "{}"
fi

exit 0
