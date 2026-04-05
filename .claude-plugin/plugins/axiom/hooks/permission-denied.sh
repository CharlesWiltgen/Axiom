#!/usr/bin/env bash
# PermissionDenied hook for Axiom plugin
# Fires after auto mode classifier denies a tool call
# Returns {retry: true} with context for recoverable denials
# Note: Avoiding 'set -euo pipefail' for robustness

input_json=$(cat)

python3 - "$input_json" <<'PYTHON_SCRIPT'
import json
import sys

try:
    input_data = json.loads(sys.argv[1])
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
except Exception:
    print("{}")
    sys.exit(0)

# Extract command for Bash tool denials
command = ""
if tool_name == "Bash":
    command = tool_input.get("command", "")

# Axiom agents primarily need Bash for read-only diagnostics
# Provide context about what the command does and why it's safe
retry_patterns = {
    "xcodebuild": "Axiom agent needs xcodebuild to diagnose build failures. This is a standard Xcode build command.",
    "xcrun simctl": "Axiom agent needs simctl to check simulator state. This is a read-only simulator query.",
    "xclog": "Axiom agent needs xclog to capture console output for diagnosis. This reads simulator logs.",
    "ps aux": "Axiom agent is checking for zombie xcodebuild processes. This is a read-only process listing.",
    "killall xcodebuild": "Axiom agent is cleaning up zombie xcodebuild processes that block new builds.",
    "xcodebuild -resolvePackageDependencies": "Axiom agent is resolving SPM packages. This is a standard dependency resolution.",
    "xcodebuild -showBuildSettings": "Axiom agent is reading build settings. This is a read-only query.",
    "xcrun xctrace": "Axiom agent needs xctrace for performance profiling. This records a trace for analysis.",
    "swift build": "Axiom agent needs to build Swift code for verification.",
    "swift test": "Axiom agent needs to run tests for verification.",
}

if tool_name == "Bash" and command:
    for pattern, reason in retry_patterns.items():
        if pattern in command:
            output = {
                "retry": True,
                "message": reason
            }
            print(json.dumps(output))
            sys.exit(0)

# For non-matching denials, don't retry — respect the user's boundary
print("{}")
sys.exit(0)
PYTHON_SCRIPT

exit 0
