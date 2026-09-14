# liquid-glass-auditor

Scans SwiftUI codebases for Liquid Glass adoption opportunities AND adoption-completeness gaps — both surfaces where the iOS 26+ visual treatment isn't yet applied (old `UIBlurEffect`/`NSVisualEffectView`/`.material`, custom floating views without glass, positionally placed toolbar actions, search bars in old positions) and adoption issues like unstyled pre-26 fallbacks, wrong variant for content type (Regular vs Clear), nested glass causing visual muddiness, an app-wide `UIDesignRequiresCompatibility` opt-out, and missing accessibility re-check after glass adoption.

## Note on Audit Framing

Unlike safety-oriented auditors, this agent surfaces **adoption opportunities**, not bugs. A pre-adoption codebase isn't broken — it's pre-adoption. The Health Score reflects adoption progress (NOT ADOPTED → PARTIAL → ADOPTED), and findings are ranked by user-visible impact rather than danger.

## What It Does

- Detects 7 known adoption patterns: legacy `UIBlurEffect`/`NSVisualEffectView`/`.material` on floating surfaces; sheet toolbars that place Save/Cancel by position instead of `.confirmationAction`/`.cancellationAction`; custom floating views without glass; search (`.searchable` outside `NavigationSplitView`, or no `Tab(role: .search)`); nested glass-on-glass layering; prominent buttons that need a semantic tint; and custom tappable glass without `.glassEffect(.regular.interactive())`
- Flags an app-wide `UIDesignRequiresCompatibility` opt-out, which hides adoption from iOS 26 users and stops applying on iOS 27 once the app builds with the 27 SDK
- Identifies adoption-completeness gaps (a designed `else` branch for every `if #available(iOS 26)` around glass, Clear variant chosen for media-overlay surfaces, accessibility contrast re-check after glass adoption, flattened nesting, `Tab(role: .search)` for tab apps, semantic placement of commit and dismiss actions, mixed `.material` + `.glassEffect()` reviewed for consistency, snapshot tests on iOS 18 + iOS 26, interactive glass on tappable surfaces, glass-adoption rubric for consistency)
- Correlates findings that compound priority (legacy `.material` + iOS 26+ deployment target = ship-ready migration, glass over media + Regular variant = color distortion, glass adoption + no accessibility re-check = potential WCAG regression, nested glass = visual mud, compatibility opt-out + any opportunity = unreviewed design change on the first 27-SDK build)
- Produces a Liquid Glass Adoption Health Score (ADOPTED / PARTIAL / NOT ADOPTED — adoption progress, not danger)

## How to Use

**Natural language:**
- "Can you check my app for Liquid Glass adoption opportunities?"
- "I'm updating my app to iOS 26, what UI improvements can I make?"
- "Review my SwiftUI code for Liquid Glass patterns"
- "I have old UIBlurEffect code, should I migrate to Liquid Glass?"

**Explicit command:**
```bash
/axiom:audit liquid-glass
```

## Related

- **liquid-glass** skill (axiom-design) – design intent, component guidance, when to use Regular vs Clear variants, and the `UIDesignRequiresCompatibility` opt-out
- **liquid-glass-ref** skill (axiom-design) – comprehensive app-wide adoption guide and API reference
- **accessibility-auditor** agent – overlaps on contrast regression after glass adoption (re-run after migration)
- **swiftui-performance-analyzer** agent – overlaps on nested-glass frame-time impact on older devices
- **modernization-helper** agent – overlaps on adjacent modernization (`ObservableObject` → `Observable`, `@StateObject` → `@State`)
- **axiom-build** skills – overlaps on deployment-target and availability gating
- **axiom-shipping** skills – overlaps on submission requirements when raising deployment target
- **health-check** agent – includes liquid-glass-auditor in project-wide scans
