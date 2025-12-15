# /axiom:audit

Smart audit selector that analyzes your project context to suggest the most relevant audits to run.

## Command

```bash
/axiom:audit [area]
```

## What It Does
- **With argument**: Runs the specific audit requested (e.g. `performance`, `accessibility`)
- **Without argument**: Scans your project structure to suggest relevant audits based on:
  - Project type (SwiftUI vs UIKit)
  - Data model presence (.xcdatamodeld, Realm, SwiftData)
  - Entitlements (CloudKit, App Groups)
  - Deployment target versions

## Arguments
- `area` (optional): The specific domain to audit. Common values:
  - `accessibility`
  - `concurrency`
  - `memory`
  - `performance` (or `swiftui-performance`)
  - `nav` (or `swiftui-nav`)
  - `core-data`
  - `networking`
  - `liquid-glass`
  - `build`

## Example Output

**When run without arguments:**

```text
📊 Axiom Audit Selector
═══════════════════════

Analysis:
- SwiftUI project detected
- Core Data model found (Model.xcdatamodeld)
- Deployment target: iOS 16.0

Recommended Audits:
1. /axiom:audit-swiftui-performance (Optimize your View hierarchy)
2. /axiom:audit-core-data (Check for thread safety and migration risks)
3. /axiom:audit-accessibility (Verify WCAG compliance)

Run specific audit? [1/2/3/N]:
```

## Related
- [/axiom:status](./status.md) - Check project environment health
