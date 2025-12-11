#!/bin/bash
# Format Swift files after edits (requires swiftformat)

FILE_PATH="$TOOL_INPUT_FILE_PATH"

# Only process .swift files
if [[ "$FILE_PATH" != *.swift ]]; then
  exit 0
fi

# Require swiftformat
if ! command -v swiftformat &> /dev/null; then
  echo "⚠️ Axiom: swiftformat not found. Install with: brew install swiftformat"
  exit 0  # Don't block the edit operation
fi

swiftformat "$FILE_PATH" --quiet
