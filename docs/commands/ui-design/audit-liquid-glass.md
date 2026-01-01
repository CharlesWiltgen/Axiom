---
name: audit-liquid-glass
description: Automated scan for Liquid Glass adoption opportunities and migration from old blur effects
---

# Liquid Glass Audit

Scan your SwiftUI codebase for Liquid Glass adoption opportunities, toolbar improvements, and migration opportunities from older blur effects.

## What It Scans

### High Priority (Migration)
- `UIBlurEffect` and `NSVisualEffectView` usage
- `.blur()` modifier on backgrounds
- `Material` that could migrate to Liquid Glass

### Medium Priority (Improvements)
- Toolbar buttons missing `.borderedProminent`
- `.borderedProminent` without `.tint()`
- Toolbars that could use `Spacer(.fixed)` for grouping
- `.searchable()` not in NavigationSplitView

### Low Priority (Enhancements)
- Custom views that could benefit from `.glassBackgroundEffect()`
- Search-related tabs missing `.tabRole(.search)`

## Usage

```bash
# Scan entire project
/axiom:audit liquid-glass

# Or use the general audit command
/axiom:audit
# Then select "liquid-glass" from suggestions
```

## Example Output

```
=== Liquid Glass Adoption Audit ===

HIGH Priority (Migration):
  src/Views/OverlayView.swift:67
    Current: .background(.ultraThinMaterial)
    Recommendation: .glassEffect() for iOS 26+

MEDIUM Priority (Improvements):
  src/Views/MainToolbar.swift:23
    Toolbar missing button grouping
    Add Spacer(.fixed) between button groups

Summary:
  - 6 migration opportunities (old blur effects)
  - 3 toolbar improvements
  - 2 search pattern updates
```

## Related

- [liquid-glass](/skills/ui-design/liquid-glass) — Implementation patterns and adoption guidance
- [swiftui-26-ref](/reference/swiftui-26-ref) — iOS 26 SwiftUI features including Liquid Glass APIs
- [liquid-glass-auditor](/agents/liquid-glass-auditor) — Automated agent for deeper analysis

## Requirements

- iOS 26+ for Liquid Glass features
- Xcode 26+ for latest SwiftUI APIs
