# spm-conflict-resolver

Analyzes Package.swift and Package.resolved to diagnose and resolve Swift Package Manager dependency conflicts.

## How to Use This Agent

**Natural language (automatic triggering):**
- "SPM won't resolve my dependencies"
- "I'm getting 'No such module' after adding a package"
- "Duplicate symbol linker error"
- "Two packages require different versions of the same dependency"
- "Package won't build with Swift 6"

**Explicit command:**
```bash
/axiom:resolve-deps
```

## What It Checks

### Critical Issues
- **Version range conflicts** — Two packages require incompatible versions of shared dependency
- **Duplicate symbols** — Same library linked twice (static + dynamic, or two versions)

### High Priority
- **Swift 6 language mode mismatch** — Package compiled with Swift 5 but client uses Swift 6
- **Missing transitive dependency** — Stale or corrupted Package.resolved

### Medium Priority
- **Macro target build failure** — Swift macros need special Xcode permissions
- **Platform version mismatch** — Package requires higher iOS/macOS version

## Example Output

```markdown
# SPM Dependency Analysis

## Summary
- **CRITICAL Conflicts**: 1
- **HIGH Issues**: 2

## CRITICAL: Version Range Conflict

**Conflict**: Alamofire version mismatch
- `PackageA` requires: `>= 5.8.0`
- `PackageB` requires: `< 5.5.0`

**Resolution Options**:
1. **Update PackageB** to version supporting Alamofire 5.8+
2. **Fork and patch** the stricter package
3. **Pin specific version** (may break features)

## Resolution Commands
```bash
rm -rf .build
rm Package.resolved
swift package resolve
```
```

## Model & Tools

- **Model**: haiku (fast dependency analysis)
- **Tools**: Glob, Grep, Read, Bash
- **Color**: blue

## Related

- [build-debugging](/skills/debugging/build-debugging) — Dependency resolution for CocoaPods and SPM
- [build-fixer](/agents/build-fixer) — Environment-first Xcode diagnostics
