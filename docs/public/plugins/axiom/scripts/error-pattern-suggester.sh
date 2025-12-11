#!/bin/bash
# Detect iOS error patterns and suggest relevant skills

OUTPUT="$CLAUDE_TOOL_OUTPUT"

# Auto Layout
echo "$OUTPUT" | grep -qE "Unable to simultaneously satisfy constraints" && \
  echo "💡 Auto Layout conflict. Try: skill auto-layout-debugging"

# Concurrency
echo "$OUTPUT" | grep -qE "Actor-isolated|Sendable|data race|@MainActor" && \
  echo "💡 Concurrency issue. Try: skill swift-concurrency"

# Database
echo "$OUTPUT" | grep -qE "no such column|FOREIGN KEY constraint|migration" && \
  echo "💡 Database migration issue. Try: skill database-migration"

# Memory
echo "$OUTPUT" | grep -qE "retain cycle|memory leak|deinit.*never called" && \
  echo "💡 Memory issue detected. Try: skill memory-debugging"

# SwiftData/CloudKit
echo "$OUTPUT" | grep -qE "CloudKit.*error|CKError|iCloud.*sync" && \
  echo "💡 CloudKit issue. Try: skill swiftdata (CloudKit section)"

# Build errors
echo "$OUTPUT" | grep -qE "error:.*module.*not found|linker command failed" && \
  echo "💡 Build configuration issue. Try: /axiom:fix-build"

exit 0
