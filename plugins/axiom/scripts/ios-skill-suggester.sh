#!/bin/bash
# Suggest Axiom skills for iOS-related prompts (once per session)

PROMPT="$CLAUDE_USER_PROMPT"
# Use parent PID for session consistency (PPID is stable across hook invocations)
MARKER_FILE="/tmp/axiom-suggested-${PPID}"

# Exit silently if prompt is empty or a command
[[ -z "$PROMPT" || "$PROMPT" == /* ]] && exit 0

# Only suggest once per session
[[ -f "$MARKER_FILE" ]] && exit 0

# Check for iOS-related keywords (case-insensitive)
if echo "$PROMPT" | grep -iqE "(swift|swiftui|xcode|ios|iphone|ipad|macos|visionos|uitableview|uikit|coredata|swiftdata|cloudkit|build fail|simulator|app store|testflight|concurrency|actor|sendable|@mainactor)"; then

  # Don't suggest if already using Axiom
  echo "$PROMPT" | grep -iq "axiom" && exit 0

  # Mark that we've suggested (once per session)
  touch "$MARKER_FILE"

  # Provide context to Claude Code
  echo "💡 Axiom has specialized iOS skills that may help. Consider:"

  # Match specific patterns
  echo "$PROMPT" | grep -iqE "(build fail|compile|error.*swift)" && echo "   • /axiom:fix-build - diagnose build failures"
  echo "$PROMPT" | grep -iqE "(swiftui.*performance|slow.*ui|lag)" && echo "   • skill: swiftui-performance"
  echo "$PROMPT" | grep -iqE "(memory|leak|retain)" && echo "   • skill: memory-debugging"
  echo "$PROMPT" | grep -iqE "(concurrency|actor|sendable|@mainactor|data race)" && echo "   • skill: swift-concurrency"
  echo "$PROMPT" | grep -iqE "(navigation|navigationstack|navigationsplitview)" && echo "   • skill: swiftui-nav"
  echo "$PROMPT" | grep -iqE "(swiftdata|cloudkit|persistence)" && echo "   • skill: swiftdata"
  echo "$PROMPT" | grep -iqE "(accessibility|voiceover|dynamic type)" && echo "   • skill: accessibility-debugging"

  echo "   • /axiom:ask - route to the right skill automatically"
fi

exit 0
