# Swift Modern Idioms Skill — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a new `axiom-swift-modern` skill that corrects Claude's tendency to generate outdated Swift patterns, plus mine high-value content gaps from Paul Hudson's SwiftUI Pro into existing Axiom skills.

**Architecture:** New standalone skill with gotcha tables (not a discipline skill — no decision trees or pressure scenarios). Routed via `axiom-ios-performance`. Also patch 5 existing skills with specific content gaps identified in the Hudson gap analysis.

**Tech Stack:** Axiom skill files (SKILL.md), VitePress doc pages, router updates

**Source material:** `/Users/Charles/Downloads/SwiftUI-Agent-Skill-main/swiftui-pro/references/` (Paul Hudson's SwiftUI Pro)

---

### Task 1: Create `axiom-swift-modern` Skill

**Files:**
- Create: `.claude-plugin/plugins/axiom/skills/axiom-swift-modern/SKILL.md`

**Step 1: Create the skill directory**

```bash
mkdir -p .claude-plugin/plugins/axiom/skills/axiom-swift-modern
```

**Step 2: Write the skill file**

Create `.claude-plugin/plugins/axiom/skills/axiom-swift-modern/SKILL.md` with this content:

```markdown
---
name: axiom-swift-modern
description: Use when reviewing or generating Swift code for modern idiom correctness — catches outdated APIs, pre-Swift 5.5 patterns, and Foundation legacy usage that Claude defaults to
license: MIT
---

# Modern Swift Idioms

## Purpose

Claude frequently generates outdated Swift patterns from its training data. This skill corrects the most common ones — patterns that compile fine but use legacy APIs when modern equivalents are clearer, more efficient, or more correct.

**Philosophy**: "Don't repeat what LLMs already know — focus on edge cases, surprises, soft deprecations." (Paul Hudson)

## Modern API Replacements

| Old Pattern | Modern Swift | Since | Why |
|-------------|-------------|-------|-----|
| `Date()` | `Date.now` | 5.6 | Clearer intent |
| `filter { }.count` | `count(where:)` | 6.0 | Single pass, no intermediate allocation |
| `replacingOccurrences(of:with:)` | `replacing(_:with:)` | 5.7 | Swift native, no Foundation bridge |
| `CGFloat` | `Double` | 5.5 | Implicit bridging; use CGFloat only for optionals/inout |
| `Task.sleep(nanoseconds:)` | `Task.sleep(for: .seconds(1))` | 5.7 | Type-safe Duration API |
| `DateFormatter()` | `.formatted()` / `FormatStyle` | 5.5 | No instance management, localizable by default |
| `String(format: "%.2f", val)` | `val.formatted(.number.precision(.fractionLength(2)))` | 5.5 | Type-safe, localized |
| `localizedCaseInsensitiveContains()` | `localizedStandardContains()` | 5.0 | Handles diacritics, ligatures, width variants |
| `"\(firstName) \(lastName)"` | `PersonNameComponents` with `.formatted()` | 5.5 | Respects locale name ordering |
| `"yyyy-MM-dd"` with DateFormatter | `Date(string, strategy: .iso8601)` | 5.6 | Modern parsing; use "y" not "yyyy" for display |
| `contains()` on user input | `localizedStandardContains()` | 5.0 | Required for correct text search/filtering |

## Modern Syntax

| Old Pattern | Modern Swift | Since |
|-------------|-------------|-------|
| `if let value = value {` | `if let value {` | 5.7 |
| Explicit `return` in single-expression | Omit `return`; `if`/`switch` are expressions | 5.9 |
| `Circle()` in modifiers | `.circle` (static member lookup) | 5.5 |
| `import UIKit` alongside `import SwiftUI` | Not needed — SwiftUI re-exports UIKit/AppKit types | 5.5 |

## Foundation Modernization

| Old Pattern | Modern Foundation | Since |
|-------------|------------------|-------|
| `FileManager.default.urls(for: .documentDirectory, ...)` | `URL.documentsDirectory` | 5.7 |
| `url.appendingPathComponent("file")` | `url.appending(path: "file")` | 5.7 |
| `books.sorted { $0.author < $1.author }` (repeated) | Conform to `Comparable`, call `.sorted()` | — |
| `"yyyy"` in date format for display | `"y"` — correct in all calendar systems | — |

## Common Claude Hallucinations

These patterns appear frequently in Claude-generated code:

1. **Creates `DateFormatter` instances inline** — Use `.formatted()` or `FormatStyle` instead. If a formatter must exist, make it `static let`.
2. **Uses `DispatchQueue.main.async`** — Use `@MainActor` or `MainActor.run`. Never GCD. (See `axiom-swift-concurrency` for full guidance.)
3. **Uses `CGFloat` for SwiftUI parameters** — `Double` works everywhere since Swift 5.5 implicit bridging.
4. **Generates `guard let x = x else`** — Use `guard let x else` shorthand.
5. **Returns explicitly in single-expression computed properties** — Omit `return`.

## Resources

**Skills**: axiom-swift-performance, axiom-swift-concurrency, axiom-swiftui-architecture
```

**Step 3: Verify the skill file exists**

```bash
cat .claude-plugin/plugins/axiom/skills/axiom-swift-modern/SKILL.md | head -5
```
Expected: frontmatter header with `name: axiom-swift-modern`

**Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-swift-modern/SKILL.md
git commit -m "feat: add axiom-swift-modern skill for modern Swift idiom corrections"
```

---

### Task 2: Add Routing in `axiom-ios-performance`

**Files:**
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-ios-performance/SKILL.md`

**Step 1: Add routing entry to the Swift Performance section (~line 104-111)**

After the existing "Swift performance scan" entry (line 111), add:

```markdown

**Modern Swift idioms** → `/skill axiom-swift-modern`
- Outdated API patterns (Date(), CGFloat, DateFormatter)
- Foundation modernization (URL.documentsDirectory, FormatStyle)
- Claude-specific hallucination corrections
```

**Step 2: Add decision tree entry (~line 154-161)**

After item 22, add:

```
23. Code review for outdated Swift patterns? → swift-modern
24. Claude generating legacy APIs (DateFormatter, CGFloat, DispatchQueue)? → swift-modern
```

**Step 3: Add anti-rationalization row (~line 164-176)**

Add to the anti-rationalization table:

```
| "Claude already knows modern Swift" | Claude defaults to pre-5.5 patterns (Date(), CGFloat, filter().count). swift-modern has the correction table. |
```

**Step 4: Add example invocations (~line 197-281)**

Add:

```markdown

User: "Review my Swift code for outdated patterns"
→ Invoke: `/skill axiom-swift-modern`

User: "Is there a more modern way to do this?"
→ Invoke: `/skill axiom-swift-modern`
```

**Step 5: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-ios-performance/SKILL.md
git commit -m "feat: route axiom-swift-modern through ios-performance router"
```

---

### Task 3: Mine Content Gaps into `axiom-swiftui-architecture`

**Files:**
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-swiftui-architecture/SKILL.md`

**Step 1: Read the full file to find the right insertion points**

Read the entire SKILL.md to find the property wrapper section and anti-patterns section.

**Step 2: Add `@AppStorage` inside `@Observable` warning**

Find the property wrapper section or anti-patterns section. Add:

```markdown
#### @AppStorage Inside @Observable

**Never use `@AppStorage` inside an `@Observable` class** — it silently breaks observation. `@AppStorage` is a property wrapper designed for SwiftUI views, not model classes.

```swift
// ❌ BROKEN — @AppStorage silently breaks @Observable
@Observable
class Settings {
    @AppStorage("theme") var theme = "light"  // Changes won't trigger view updates
}

// ✅ Read @AppStorage in view, pass to model
struct SettingsView: View {
    @AppStorage("theme") private var theme = "light"
    // ...
}
```
```

**Step 3: Add `Binding(get:set:)` anti-pattern**

In the anti-patterns section, add:

```markdown
#### Binding(get:set:) in View Body

Creating `Binding(get:set:)` in the view body creates a new binding on every evaluation, breaking SwiftUI's identity tracking.

```swift
// ❌ New Binding created every body evaluation
var body: some View {
    TextField("Name", text: Binding(
        get: { model.name },
        set: { model.name = $0 }
    ))
}

// ✅ Use @Bindable or computed binding
var body: some View {
    @Bindable var model = model
    TextField("Name", text: $model.name)
}
```
```

**Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-swiftui-architecture/SKILL.md
git commit -m "feat: add @AppStorage and Binding anti-patterns to swiftui-architecture"
```

---

### Task 4: Mine Content Gaps into Accessibility Skills

**Files:**
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-ios-accessibility/SKILL.md` (router)

**Step 1: Read the accessibility router to find insertion point**

Read the router file to find where accessibility patterns are listed.

**Step 2: Add `Image(decorative:)` and `accessibilityInputLabels()` and `accessibilityDifferentiateWithoutColor`**

Add these to the appropriate routing entries or critical patterns section:

```markdown
#### Image Accessibility

- Use `Image(decorative: "photo")` for purely decorative images — automatically hidden from VoiceOver (equivalent to `accessibilityHidden(true)`)
- Use `accessibilityInputLabels()` for buttons with complex or changing labels — improves Voice Control accuracy
- Respect `accessibilityDifferentiateWithoutColor` — check this environment value and provide non-color cues (icons, patterns, labels) when active
```

**Step 3: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-ios-accessibility/SKILL.md
git commit -m "feat: add Image(decorative:), accessibilityInputLabels, differentiateWithoutColor to accessibility router"
```

---

### Task 5: Mine Content Gaps into Navigation and Other Skills

**Files:**
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-swiftui-nav-ref/SKILL.md`
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-typography-ref/SKILL.md`
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-swiftui-26-ref/SKILL.md`

**Step 1: Read each file to find insertion points**

Read the three files to identify where each gap fits.

**Step 2: Add to `swiftui-nav-ref`**

Find the navigation patterns section. Add:

```markdown
#### Navigation Anti-Patterns

- **Never mix `navigationDestination(for:)` and `NavigationLink(destination:)`** in the same NavigationStack hierarchy — causes undefined behavior
- **Register `navigationDestination(for:)` once per data type** — duplicates cause the wrong view to appear
- **Attach `confirmationDialog()` to triggering UI** — Liquid Glass morphing animations require the dialog source to be the element that triggered it
```

**Step 3: Add to `typography-ref`**

Find the font size guidance section. Add:

```markdown
#### Font Size Guidance

- **Avoid `.caption2`** — too small for comfortable reading on any device. Prefer `.caption` or `.footnote` as the minimum body text size.
```

**Step 4: Add to `swiftui-26-ref`**

Find the appropriate section for these iOS 26+ patterns. Add:

```markdown
#### TextField and TextEditor

- **Prefer `TextField("Label", text: $text, axis: .vertical)`** over `TextEditor` — supports placeholder text, consistent styling, and automatic vertical expansion

#### ContentUnavailableView

- **`ContentUnavailableView.search(text: searchText)`** automatically includes the search term in the message — no need to compose a custom string

#### LabeledContent in Forms

- **Wrap controls in `LabeledContent` within Forms** — provides consistent label alignment without manual HStack layout
```

**Step 5: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-swiftui-nav-ref/SKILL.md \
        .claude-plugin/plugins/axiom/skills/axiom-typography-ref/SKILL.md \
        .claude-plugin/plugins/axiom/skills/axiom-swiftui-26-ref/SKILL.md
git commit -m "feat: add navigation anti-patterns, typography, and SwiftUI 26 gaps from Hudson analysis"
```

---

### Task 6: Create VitePress Documentation Page

**Files:**
- Create: `docs/skills/concurrency/swift-modern.md`
- Modify: `docs/skills/concurrency/index.md`

**Step 1: Create the doc page**

Create `docs/skills/concurrency/swift-modern.md`:

```markdown
# Modern Swift Idioms

Corrects Claude's tendency to generate outdated Swift patterns — legacy APIs, pre-Swift 5.5 syntax, and Foundation patterns that have modern replacements.

## When to Use

Use this skill when:
- Reviewing generated Swift code for modern idiom compliance
- You notice Claude using `Date()`, `CGFloat`, `DateFormatter()`, or other legacy patterns
- Asking "is there a more modern way to do this?"
- Code review for Swift 5.5+ / 6.0+ API adoption

## Example Prompts

- "Review my Swift code for outdated patterns"
- "Is there a more modern way to write this?"
- "Why am I using DateFormatter when I could use FormatStyle?"
- "Check if my Foundation usage is current"

## What This Skill Provides

- **Modern API replacements** — 11 common outdated patterns with modern equivalents and Swift version requirements
- **Modern syntax** — Shorthand syntax, static member lookup, expression returns
- **Foundation modernization** — URL APIs, date parsing, name formatting, sort patterns
- **Claude hallucination corrections** — 5 specific patterns Claude generates incorrectly

## Philosophy

Based on Paul Hudson's principle: "Don't repeat what LLMs already know — focus on edge cases, surprises, soft deprecations."

This skill is intentionally small. It only covers patterns where Claude consistently generates the wrong thing. General Swift knowledge doesn't need to be in a skill.

## Related

- [Swift Performance](/skills/concurrency/swift-performance) — Low-level optimization (COW, ARC, generics) — different from idiom correctness
- [Swift Concurrency](/skills/concurrency/swift-concurrency) — async/await, actors, Sendable patterns
- [Modernization Helper](/agents/modernization-helper) — Agent that scans for SwiftUI-specific legacy patterns (ObservableObject → @Observable)
```

**Step 2: Add entry to concurrency index page**

Read `docs/skills/concurrency/index.md` and add an entry for `swift-modern` in the appropriate position.

**Step 3: Verify docs build**

```bash
npm run docs:build
```
Expected: Build succeeds with no dead links.

**Step 4: Commit**

```bash
git add docs/skills/concurrency/swift-modern.md docs/skills/concurrency/index.md
git commit -m "docs: add swift-modern skill documentation page"
```

---

### Task 7: Update Modernization Helper Agent

**Files:**
- Modify: `.claude-plugin/plugins/axiom/agents/modernization-helper.md`

**Step 1: Read the agent file** (already read above)

**Step 2: Add Swift language modernization patterns**

The current agent only covers SwiftUI patterns (ObservableObject → @Observable). Add a new section for Swift language patterns that references the new skill:

After the existing "Modernization Patterns" section, add:

```markdown
### Pattern 8: Swift Language Modernization (LOW)

**Why migrate**: Clearer, more efficient, modern Swift idioms

**Detection**:
```
Grep: Date()
Grep: CGFloat
Grep: replacingOccurrences
Grep: DateFormatter()
Grep: filter(.*).count
Grep: Task\.sleep\(nanoseconds:
```

**Reference**: See `axiom-swift-modern` skill for the full modern API replacement table.

Report matches as LOW priority unless they appear in hot paths (then MEDIUM).
```

**Step 3: Update the agent's skills injection**

Add `axiom-ios-performance` to the skills list if not already present, since that's where swift-modern routes through.

**Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/agents/modernization-helper.md
git commit -m "feat: add Swift language modernization patterns to modernization-helper agent"
```

---

### Task 8: Rebuild MCP Server Bundle

**Step 1: Rebuild the bundle**

```bash
cd axiom-mcp && pnpm run build:bundle
```
Expected: Build succeeds, `bundle.json` is regenerated with the new skill.

**Step 2: Verify new skill appears in bundle**

```bash
cd /Users/Charles/Projects/Axiom && node -e "const b = require('./axiom-mcp/dist/bundle.json'); const s = b.skills.find(s => s.name === 'axiom-swift-modern'); console.log(s ? 'Found: ' + s.name : 'NOT FOUND')"
```
Expected: `Found: axiom-swift-modern`

**Step 3: Commit**

```bash
git add axiom-mcp/dist/bundle.json
git commit -m "chore: rebuild MCP server bundle with axiom-swift-modern"
```

---

### Task 9: Final Validation

**Step 1: Validate character budget**

```bash
node -e "
const data = require('./.claude-plugin/plugins/axiom/claude-code.json');
let skillTotal = 0;
data.skills.forEach(s => skillTotal += s.description.length);
console.log('Skills:', skillTotal, 'chars');
console.log('Budget: 15,000 chars');
console.log('Status:', skillTotal <= 15000 ? '✓ UNDER' : '✗ OVER', 'by', Math.abs(15000 - skillTotal));
"
```
Expected: Still under 15,000 (no manifest changes, so should be identical to current ~3,639)

**Step 2: Verify VitePress build**

```bash
npm run docs:build
```
Expected: Build succeeds, no dead links.

**Step 3: Verify all commits are clean**

```bash
git status
git log --oneline -10
```
Expected: Clean working tree, 7-8 new commits.
