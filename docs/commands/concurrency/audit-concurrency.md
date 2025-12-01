# `/audit-concurrency`

**Comprehensive analysis of Swift 6 concurrency issues and violations.**

## Purpose

Performs a thorough scan of your Swift codebase for concurrency anti-patterns and violations. This is a **comprehensive audit** that analyzes all Swift files for @MainActor usage, Sendable conformance, actor isolation, and data race prevention patterns.

**Command Type:** `/audit-*` (comprehensive analysis, 2-5 minutes)

Use before the `swift-concurrency` skill to get a complete roadmap of issues with file:line references.

## When to Use

✅ **Use this command when**:
- You want to scan your codebase for concurrency issues
- You're not sure where to start with concurrency problems
- You want a quick overview before running the skill
- You need to find unsafe patterns in your code

❌ **Don't use this command for**:
- General Swift syntax questions (use Swift docs)
- One-off questions about specific patterns (use the skill instead)

## What It Detects

### High Priority (Crashes/Memory Leaks)

1. **Missing `@MainActor` annotations**
   - UIViewController, UIView, ObservableObject without `@MainActor`
   - Can cause data race crashes if accessed from background threads
   - Fix: Add `@MainActor` decorator

2. **Unsafe Task self captures**
   - `Task { self.property = value }` without `[weak self]`
   - Causes memory leaks and potential crashes
   - Fix: Use `Task { [weak self] in` pattern

### Medium Priority (Data Races)

3. **Sendable violations**
   - Non-Sendable types crossing actor boundaries
   - Causes warnings, may crash at runtime
   - Fix: Implement `Sendable` conformance

4. **Improper actor isolation**
   - Data accessed from actor context without thread-safety verification
   - Can cause data races
   - Fix: Use lightweight representations or snapshots

### Low Priority (Warnings)

5. **Unsafe weak-strong patterns**
   - Improper `[weak self]` guard patterns
   - Potential for unwanted side effects
   - Fix: Use proper optional checking

6. **Thread-confinement violations**
   - MainActor property access from background context
   - Potential issues with thread safety
   - Fix: Use lightweight representations before leaving actor context

## Usage

```
/audit-concurrency
```

The command will:
1. Find all `.swift` files in your project
2. Scan for known concurrency anti-patterns
3. Report issues with file path, line number, and severity
4. Link to the `swift-concurrency` skill for remediation

## Example Output

```
Concurrency Audit Results
═════════════════════════════════════════

HIGH PRIORITY ISSUES (3 found)
─────────────────────────────────────────

1. Missing @MainActor
   File: Sources/UI/ProfileViewController.swift:12
   Class: ProfileViewController (inherits UIViewController)
   Severity: ERROR - Data race risk
   Fix: Add @MainActor decorator
   See: swift-concurrency skill (automatically suggested)

2. Unsafe Task self capture
   File: Sources/Services/DataFetcher.swift:45
   Pattern: Task { self.updateUI() }
   Severity: ERROR - Memory leak risk
   Fix: Use Task { [weak self] in pattern
   See: swift-concurrency skill (automatically suggested) → Pattern 3: Weak Self in Tasks

3. Sendable violation
   File: Sources/Models/UserModel.swift:78
   Type: NonSendableData passed to @MainActor closure
   Severity: WARNING - Data race risk
   Fix: Implement Sendable conformance
   See: swift-concurrency skill (automatically suggested) → Pattern 1: Sendable Enum/Struct

MEDIUM PRIORITY ISSUES (2 found)
─────────────────────────────────────────

... (more issues)

SUMMARY
─────────────────────────────────────────
✓ Scanned 127 Swift files
✗ Found 5 issues (3 high, 2 medium)
→ Next: Ask about specific patterns (skill automatically activates)
```

## Next Steps

After the audit:

1. **Review the issues** – Understand what patterns are problematic
2. **Prioritize fixes** – Start with HIGH priority issues first
3. **Ask about fixes** – Request help with specific patterns

Simply ask: "How do I fix these Swift concurrency issues?" or "Show me Pattern 3: Weak Self in Tasks"

The swift-concurrency skill (automatically activated) provides:
- 12 copy-paste-ready patterns
- Decision trees for each error
- Real-world examples
- Pressure scenario handling

## Tips

- **Run regularly** – Add `/audit-concurrency` to your development workflow to catch regressions
- **Before major changes** – Run before refactoring code to establish baseline
- **Post-review** – Use after code review to ensure concurrency safety
- **CI/CD** – Consider running as part of automated checks (if supported)

## Limitations

- Pattern-based detection (regex/heuristics, not compiler analysis)
- False positives possible for complex patterns
- Tests only `.swift` files (not Objective-C)
- Designed for iOS/Swift development

## See Also

- **[Swift Concurrency Skill](/skills/concurrency/swift-concurrency)** – Deep patterns and solutions
- **[Concurrency Overview](/commands/concurrency/)** – Other concurrency-related tools
