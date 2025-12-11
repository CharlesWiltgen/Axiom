#!/bin/bash
# Quick environment health check on session start

ZOMBIE_COUNT=$(pgrep -f xcodebuild 2>/dev/null | wc -l | tr -d ' ')
DD_SIZE=$(du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null | cut -f1)

WARNINGS=""

if [ "$ZOMBIE_COUNT" -gt 5 ]; then
  WARNINGS="${WARNINGS}⚠️ $ZOMBIE_COUNT xcodebuild processes running (consider: killall xcodebuild)\n"
fi

if [[ "$DD_SIZE" == *"G"* ]]; then
  # Extract numeric part, handle formats like "15G" or "15.5G"
  GB=$(echo "$DD_SIZE" | tr -d 'G' | cut -d'.' -f1)
  # Use bash arithmetic instead of bc (not installed by default on recent macOS)
  if [ -n "$GB" ] && [ "$GB" -gt 10 ] 2>/dev/null; then
    WARNINGS="${WARNINGS}⚠️ Derived Data is ${DD_SIZE} (consider cleaning)\n"
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo "Axiom Environment Check:"
  echo -e "$WARNINGS"
fi

# Detect iOS project and announce Axiom availability
if ls *.xcodeproj >/dev/null 2>&1 || ls *.xcworkspace >/dev/null 2>&1; then
  echo "📱 iOS project detected. Axiom skills available."
  echo "   Try: /axiom:ask <your question> or browse skills with /skill axiom:getting-started"
fi
