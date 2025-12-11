# Axiom — Local Development Guidelines

**Purpose** Project-specific conventions and guidelines for Claude Code when working on Axiom. These supplement the main CLAUDE.md file.

---

## Documentation Style Guidelines

### Markdown Headers

**NEVER use colons at the end of markdown headers.** The header syntax itself provides all necessary formatting and hierarchy cues.

#### ❌ DON'T
```markdown
## Overview:
### Key Features:
#### Example:
```

#### ✅ DO
```markdown
## Overview
### Key Features
#### Example
```

**Rationale** Markdown headers already have visual weight and hierarchy from their size and formatting. Adding colons is redundant and creates visual clutter.

**Scope** This applies to:
- All skills in `.claude-plugin/plugins/axiom/skills/`
- All documentation in `docs/`
- README files
- All markdown content

**Exception** Inline bold labels within paragraphs are acceptable:
```markdown
**Key insight** This pattern prevents data loss.
**Why it matters** Users expect this behavior.
```

### Use Proper Headers, Not Bold Text

**ALWAYS use proper markdown headers (`####`) for subsections, not bold text.**

#### ❌ DON'T
```markdown
### Main Section

**Subsection Title**
- Content here
```

#### ✅ DO
```markdown
### Main Section

#### Subsection Title
- Content here
```

**Benefits**
- Proper document hierarchy and semantic structure
- Better table of contents generation
- Improved accessibility (screen readers)
- Easier navigation with header-based tools
- Consistent with markdown best practices

**Rationale** Bold text that functions as a header is a pseudo-header anti-pattern. Use the proper markdown syntax for what you're trying to express.

### WWDC Session References

#### Do NOT include WWDC session numbers in
- Section headers (e.g., "## Apple Intelligence Integration" not "## Apple Intelligence Integration (WWDC 2025-260)")
- Inline quote attributions (remove " - WWDC 2025-XXX" from quote endings)
- Feature descriptions in overview sections

#### DO include WWDC sessions in
- Resources/References sections at the end of documents
- As `### WWDC Sessions` sections with bulleted lists and links
- Code example headers in reference skills with timestamps: `#### Example (WWDC 4:04)`

**Rationale** End-user documentation should focus on the content. WWDC sessions are implementation details for developers, best kept in dedicated reference sections.

---

## Version Management

**NEVER update plugin or skill versions without explicit permission.** Version bumps are a release decision, not an automatic part of commits.

When making changes:
- Edit skills and code freely
- Commit changes with descriptive messages
- Do NOT update `version` in `claude-code.json` or skill frontmatter
- Wait for explicit instruction to bump versions

### Version Sync Rule

**When updating versions, always sync both files:**
1. `.claude-plugin/plugins/axiom/claude-code.json` — Plugin manifest
2. `.claude-plugin/marketplace.json` — Marketplace config

Both must have the same version number to avoid user confusion.

---

## Git Workflow

Always include VitePress build validation when committing documentation changes. The pre-commit hook handles this automatically.

---

## Apple Documentation Research

### WWDC Session Transcripts

Use Chrome browser to get **full verbatim transcripts + code samples** from WWDC sessions:

1. Navigate to `https://developer.apple.com/videos/play/wwdc20XX/XXXXX/`
2. Chrome auto-captures the page to `.md` file in the session directory
3. The captured transcript includes:
   - Full spoken content with timestamps
   - All code examples shown in the session
   - Chapter markers and resource links

**Example**: When navigating to WWDC 2025-278, Chrome saves `001-navigate.md` with the complete transcript.

**Session Directory**: `/Users/Charles/Library/Caches/superpowers/browser/YYYY-MM-DD/session-XXXXX/`

### Apple Documentation via sosumi.ai

Use sosumi.ai instead of developer.apple.com for markdown-formatted documentation:

**Instead of**:
```
https://developer.apple.com/documentation/widgetkit
```

**Use**:
```
https://sosumi.ai/documentation/widgetkit
```

This provides cleaner markdown output that's easier to parse and reference.

---

**Last Updated** 2025-12-08