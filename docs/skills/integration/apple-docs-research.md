---
name: apple-docs-research
description: Techniques for researching Apple frameworks and WWDC sessions
skill_type: discipline
version: 0.9
---

# Apple Documentation Research

Techniques for researching Apple frameworks, APIs, and WWDC sessions. Covers Chrome auto-capture for transcripts and sosumi.ai for documentation.

## When to Use This Skill

Use this skill when you're:
- Researching Apple frameworks or APIs (WidgetKit, SwiftUI, etc.)
- Need full WWDC session transcripts with code samples
- Looking for Apple Developer documentation
- Want to extract code examples from WWDC presentations
- Building comprehensive skills based on Apple technologies

**Do NOT use for:**
- Third-party framework documentation
- General web research
- Basic Swift language questions

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "I need to research the new WidgetKit APIs from WWDC 2025."
- "How do I get the full transcript from a WWDC session?"
- "Where can I find Apple documentation in markdown format?"
- "I want to build a skill based on WWDC sessions. How do I extract the content?"

## What's Covered

### WWDC Session Transcripts
- Chrome auto-capture technique
- Apple Developer video page structure
- Full verbatim transcripts with timestamps
- Code sample extraction

### Apple Documentation via sosumi.ai
- Markdown-formatted documentation
- Cleaner output than developer.apple.com
- URL patterns

### Time Savings
- Manual transcription: 3-4 hours per session
- Auto-capture: 2-5 minutes per session

## Key Pattern

### WWDC Transcript via Chrome

Apple Developer video pages contain complete transcripts that Chrome auto-captures.

1. **Navigate** to WWDC session:
   ```
   https://developer.apple.com/videos/play/wwdc2025/278/
   ```

2. **Chrome saves** to session directory:
   ```
   ~/Library/Caches/superpowers/browser/YYYY-MM-DD/session-XXXXX/001-navigate.md
   ```

3. **Transcript includes:**
   - Full spoken content with timestamps (e.g., [0:07], [1:23])
   - Chapter markers
   - Resource links
   - Descriptions of code shown on screen

### Apple Documentation via sosumi.ai

```bash
# Instead of:
https://developer.apple.com/documentation/widgetkit

# Use:
https://sosumi.ai/documentation/widgetkit
```

**Benefits:**
- Cleaner markdown output
- Easier to parse and reference
- Same content, better format

## Documentation Scope

This page documents the `axiom-apple-docs-research` skill—research techniques Claude uses when you need to investigate Apple frameworks, APIs, or WWDC sessions.

**For writing skills from research:** See the superpowers:writing-skills skill for creating skills from documentation.

## Related

- [extensions-widgets](/skills/integration/extensions-widgets) — Widget development patterns
- [swiftui-26-ref](/reference/swiftui-26-ref) — iOS 26 SwiftUI features from WWDC 2025

## Resources

**WWDC**: All sessions at developer.apple.com/videos/

**Docs**: sosumi.ai/documentation
