---
name: apple-docs-research
description: Use when researching Apple frameworks, APIs, or WWDC sessions - provides techniques for retrieving full transcripts, code samples, and documentation using Chrome browser and sosumi.ai
skill_type: discipline
version: 1.0.0
---

# Apple Documentation Research

## When to Use This Skill

✅ **Use this skill when**:
- Researching Apple frameworks or APIs (WidgetKit, SwiftUI, etc.)
- Need full WWDC session transcripts with code samples
- Looking for Apple Developer documentation
- Want to extract code examples from WWDC presentations
- Building comprehensive skills based on Apple technologies

❌ **Do NOT use this skill for**:
- Third-party framework documentation
- General web research
- Questions already answered in existing skills
- Basic Swift language questions (use Swift documentation)

## Related Skills

- Use **superpowers-chrome:browsing** for interactive browser control
- Use **writing-skills** when creating new skills from Apple documentation
- Use **reviewing-reference-skills** to validate Apple documentation skills

## Core Philosophy

> Apple Developer video pages contain full verbatim transcripts with timestamps and complete code samples. Chrome's auto-capture feature makes this content instantly accessible without manual copying.

**Key insight**: Don't manually transcribe or copy code from WWDC videos. The transcripts are already on the page, fully timestamped and formatted.

## WWDC Session Transcripts via Chrome

### The Technique

Apple Developer video pages (`developer.apple.com/videos/play/wwdc20XX/XXXXX/`) contain complete transcripts that Chrome auto-captures.

#### Step-by-Step Process

1. **Navigate** using Chrome browser MCP tool:
   ```json
   {
     "action": "navigate",
     "payload": "https://developer.apple.com/videos/play/wwdc2025/278/"
   }
   ```

   Tool name: `mcp__plugin_superpowers-chrome_chrome__use_browser`

   **Complete invocation**:
   ```
   Use the mcp__plugin_superpowers-chrome_chrome__use_browser tool with:
   - action: "navigate"
   - payload: "https://developer.apple.com/videos/play/wwdc2025/278/"
   ```

2. **Locate** the auto-captured file:
   - Chrome saves to: `~/.../superpowers/browser/YYYY-MM-DD/session-TIMESTAMP/`
   - Session directory uses Unix timestamp in milliseconds (e.g., `session-1765217804099`)
   - Filename pattern: `NNN-navigate.md` (e.g., `001-navigate.md`)

   **Finding the latest session**:
   ```bash
   # List sessions sorted by modification time (newest first)
   ls -lt ~/Library/Caches/superpowers/browser/*/session-* | head -5
   ```

3. **Read** the captured transcript:
   - Full spoken content with timestamps (e.g., `[0:07]`, `[1:23]`)
   - Descriptions of code and API usage (spoken, not formatted)
   - Chapter markers and resource links

### What You Get

**✅ WWDC transcripts contain:**
- Full spoken content with timestamps (e.g., `[0:07]`, `[1:23]`)
- API names mentioned by speakers (e.g., `widgetRenderingMode`, `supportedMountingStyles`)
- Descriptions of what code does ("I'll add the widgetRenderingMode environment variable")
- Step-by-step explanations of implementations
- Chapter markers and resource links

**❌ WWDC transcripts do NOT contain:**
- Formatted Swift code blocks ready to copy-paste
- Complete implementations
- Structured code examples

**Critical Understanding**: Transcripts are **spoken word, not code**. You'll read sentences like "I'll add the widgetRenderingMode environment variable to my widget view" and need to **reconstruct the code yourself** from these descriptions.

### When Code Isn't Clear from Transcript

If the transcript's code descriptions aren't detailed enough, follow this fallback workflow:

1. **Check Resources Tab**
   - Navigate back to the WWDC session page
   - Click "Resources" tab
   - Look for "Download Sample Code" or "View on GitHub"
   - Download Xcode project with complete working implementation

2. **Use sosumi.ai for API Details**
   - Look up specific APIs mentioned in transcript
   - Example: Transcript says "widgetAccentedRenderingMode" → look up `sosumi.ai/documentation/swiftui/widgetaccentedrenderingmode`
   - Get exact signature, parameters, usage

3. **Jump to Timestamp in Video**
   - Use transcript timestamp to jump directly to code explanation in video
   - Example: Transcript says code at `[4:23]` → watch that specific 30-second segment
   - Faster than watching entire 45-minute session

4. **Combine Sources**
   - Transcript = conceptual understanding + workflow
   - Resources = complete code
   - sosumi.ai = API details
   - Result: Full picture without manually reconstructing everything

**Example transcript structure**:
```markdown
# Session Title - WWDC## - Videos - Apple Developer

## Chapters
- 0:00 - Introduction
- 1:23 - Key Topic 1

## Transcript
0:00
Speaker: Welcome to this session...

[timestamp]
Now I'll add the widgetAccentedRenderingMode modifier...
```

### Example Session

**WWDC 2025-278** "What's new in widgets":
- Navigate: `https://developer.apple.com/videos/play/wwdc2025/278/`
- Captured: `001-navigate.md`
- Contains: ~15 minutes of full transcript with API references and code concepts

## Apple Documentation via sosumi.ai

### Why sosumi.ai

Developer.apple.com documentation is HTML-heavy and difficult to parse. sosumi.ai provides the same content in clean markdown format.

### URL Pattern

**Instead of**:
```
https://developer.apple.com/documentation/widgetkit
```

**Use**:
```
https://sosumi.ai/documentation/widgetkit
```

### URL Pattern Rules

**Format**: `https://sosumi.ai/documentation/[framework]`

**Rules for framework name**:
1. **Lowercase** - Use lowercase even if framework is capitalized (SwiftUI → swiftui)
2. **No spaces** - Remove all spaces (Core Data → coredata)
3. **No hyphens** - Remove all hyphens (App Intents → appintents, NOT app-intents)
4. **Case-insensitive** - Both `SwiftUI` and `swiftui` work, but lowercase is recommended

**Common mistakes**:
- ❌ `app-intents` → ✅ `appintents`
- ❌ `core-data` → ✅ `coredata`
- ❌ `AVFoundation` → ✅ `avfoundation`

**Examples**:
| Framework Name | sosumi.ai URL |
|----------------|---------------|
| SwiftUI | `sosumi.ai/documentation/swiftui` |
| App Intents | `sosumi.ai/documentation/appintents` |
| Core Data | `sosumi.ai/documentation/coredata` |
| AVFoundation | `sosumi.ai/documentation/avfoundation` |
| UIKit | `sosumi.ai/documentation/uikit` |

### Using with WebFetch or Read Tools

```
WebFetch:
  url: https://sosumi.ai/documentation/widgetkit/widget
  prompt: "Extract information about Widget protocol"

Result: Clean markdown with API signatures, descriptions, examples
```

### Framework Examples

| Framework | sosumi.ai URL |
|-----------|---------------|
| WidgetKit | `https://sosumi.ai/documentation/widgetkit` |
| SwiftUI | `https://sosumi.ai/documentation/swiftui` |
| ActivityKit | `https://sosumi.ai/documentation/activitykit` |
| App Intents | `https://sosumi.ai/documentation/appintents` |
| Foundation | `https://sosumi.ai/documentation/foundation` |

## Common Research Workflows

### Workflow 1: New iOS Feature Research

**Goal**: Create a comprehensive skill for a new iOS 26 feature.

1. **Find WWDC sessions** — Search "WWDC 2025 [feature name]"
2. **Get transcripts** — Navigate with Chrome to each session
3. **Read transcripts** — Extract key concepts, code patterns, gotchas
4. **Get API docs** — Use sosumi.ai for framework reference
5. **Cross-reference** — Verify code samples match documentation
6. **Create skill** — Combine transcript insights + API reference

**Time saved**: 3-4 hours vs. watching videos and manual transcription

### Workflow 2: API Deep Dive

**Goal**: Understand a specific API or protocol.

1. **sosumi.ai docs** — Get protocol/class definition
2. **WWDC sessions** — Search for sessions mentioning the API
3. **Code samples** — Extract from transcript code blocks
4. **Verify patterns** — Ensure examples match latest API

### Workflow 3: Multiple Sessions Research

**Goal**: Comprehensive coverage across multiple years (e.g., widgets evolution).

1. **Parallel navigation** — Use Chrome to visit 3-6 sessions
2. **Read all transcripts** — Compare how APIs evolved
3. **Extract timeline** — iOS 14 → 17 → 18 → 26 changes
4. **Consolidate** — Create unified skill with version annotations

**Example**: Extensions & Widgets skill used 6 WWDC sessions (2023-2025)

## Anti-Patterns

### ❌ DON'T: Manual Video Watching

```
BAD:
1. Play WWDC video
2. Pause and take notes
3. Rewind to capture code
4. Type out examples manually

Result: 45 minutes per session
```

### ✅ DO: Chrome Auto-Capture

```
GOOD:
1. Navigate with Chrome
2. Read captured .md file
3. Copy code blocks directly
4. Reference timestamps for context

Result: 5 minutes per session
```

### ❌ DON'T: Scrape developer.apple.com HTML

```
BAD:
Use WebFetch on developer.apple.com/documentation
Result: Complex HTML parsing required
```

### ✅ DO: Use sosumi.ai

```
GOOD:
Use WebFetch on sosumi.ai/documentation
Result: Clean markdown, instant access
```

## Troubleshooting

### Chrome Session Directory Not Found

**Symptom**: Can't locate `001-navigate.md` file

**Solution**:
1. Check Chrome actually navigated (look for URL confirmation)
2. Find latest session: `ls -lt ~/Library/Caches/superpowers/browser/*/`
3. Session directory format: `YYYY-MM-DD/session-TIMESTAMP/`

### Transcript Incomplete

**Symptom**: File exists but missing transcript

**Solution**:
1. Page may still be loading - wait 2-3 seconds
2. Try navigating again
3. Some sessions require scrolling to load full content

### sosumi.ai Returns Error

**Symptom**: 404 or invalid URL

**Solution**:
1. Verify framework name spelling
2. Check sosumi.ai format: `/documentation/[frameworkname]`
3. Fallback: Use developer.apple.com but expect HTML

## Verification Checklist

Before using captured content:
- ☐ Transcript includes timestamps
- ☐ Code samples are complete (not truncated)
- ☐ Speaker names and chapter markers present
- ☐ Multiple speakers properly attributed
- ☐ Code syntax highlighting preserved

## Resources

**Skills**: superpowers-chrome:browsing, writing-skills, reviewing-reference-skills

---

**Time Saved**: Using this technique saves 30-40 minutes per WWDC session vs. manual video watching and transcription. For comprehensive research spanning multiple sessions, savings compound to 3-4 hours per skill.
