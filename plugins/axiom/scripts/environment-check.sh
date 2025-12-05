#!/bin/bash
# Quick environment health check on session start

ZOMBIE_COUNT=$(pgrep -f xcodebuild 2>/dev/null | wc -l | tr -d ' ')
DD_SIZE=$(du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null | cut -f1)

WARNINGS=""

if [ "$ZOMBIE_COUNT" -gt 5 ]; then
  WARNINGS="${WARNINGS}⚠️ $ZOMBIE_COUNT xcodebuild processes running (consider: killall xcodebuild)\n"
fi

if [[ "$DD_SIZE" == *"G"* ]]; then
  GB=$(echo "$DD_SIZE" | tr -d 'G')
  if (( $(echo "$GB > 10" | bc -l) )); then
    WARNINGS="${WARNINGS}⚠️ Derived Data is ${DD_SIZE} (consider cleaning)\n"
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo "Axiom Environment Check:"
  echo -e "$WARNINGS"
fi
