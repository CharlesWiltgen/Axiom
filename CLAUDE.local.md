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
- All skills in `plugins/axiom/skills/`
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

See main CLAUDE.md for version increment rules. TL;DR: Always increment by **0.0.1** unless explicitly instructed otherwise.

---

## Git Workflow

Always include VitePress build validation when committing documentation changes. The pre-commit hook handles this automatically.

---

**Last Updated** 2025-12-03
