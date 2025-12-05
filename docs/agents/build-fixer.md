# build-fixer

Automatically diagnoses and fixes Xcode build failures using environment-first diagnostics.

## How to Use This Agent

**Natural language (automatic triggering):**
- "My build is failing"
- "BUILD FAILED but no error details"
- "Xcode says 'No such module'"
- "Tests passed yesterday but now they're failing"
- "Getting 'Unable to boot simulator' error"

**Explicit command:**
```bash
/axiom:fix-build
```

## What It Checks

### Environment Diagnostics (Mandatory)
1. **Zombie xcodebuild processes** — 10+ processes = stuck builds
2. **Derived Data size** — >10GB = stale cache
3. **Simulator state** — Stuck in Booting/Shutting Down

### Common Issues Fixed
- Zombie processes → `killall xcodebuild`
- Stale Derived Data → Clean and rebuild
- Stuck simulators → `xcrun simctl shutdown all`
- "No such module" → SPM cache reset
- Old code executing → Force clean rebuild

## How It Works

**Core Principle**: 80% of "mysterious" Xcode issues are environment problems, not code bugs.

**Workflow**:
1. Run 3 mandatory diagnostic checks (30 seconds)
2. Identify specific issue type
3. Apply appropriate fix automatically
4. Verify fix worked
5. Report results

## Example Output

```markdown
## Build Failure Diagnosis Complete

### Environment Check Results
- Xcodebuild processes: 23 found (problem - should be 0-2)
- Derived Data size: 15.2 GB (stale - should be <10GB)
- Simulator state: 1 stuck in "Booting" (problem)

### Issue Identified
Multiple issues: Zombie processes + stale Derived Data + stuck simulator

### Fix Applied
1. Killed 23 zombie xcodebuild processes
2. Cleaned Derived Data (freed 15.2 GB)
3. Shutdown stuck simulator
4. Performed clean rebuild

### Verification
✅ Build succeeded after fixes

### Time Saved
Estimated 30-45 minutes of manual debugging avoided
```

## Saves Time

- **Without agent**: 30-120 minutes debugging environment issues
- **With agent**: 2-5 minutes automated diagnosis and fixes

## Model & Tools

- **Model**: sonnet (needs reasoning for environment diagnosis)
- **Tools**: Bash, Read, Grep, Glob
- **Color**: blue

## Related Skills

For detailed understanding of environment-first debugging:
- **xcode-debugging** skill — Step-by-step diagnostic workflows
