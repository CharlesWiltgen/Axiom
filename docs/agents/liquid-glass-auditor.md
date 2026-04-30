# liquid-glass-auditor

Scans SwiftUI codebases for Liquid Glass adoption opportunities AND adoption-completeness gaps — both surfaces where the iOS 26+ visual treatment isn't yet applied (old `UIBlurEffect`/`NSVisualEffectView`/`.material`, custom containers without glass, legacy toolbar styling, search bars in old positions) and adoption issues like ungated effects on older OS, wrong variant for content type (Regular vs Clear), nested glass causing visual muddiness, missing tint discipline on primary actions, and missing accessibility re-check after glass adoption.

## Note on Audit Framing

Unlike safety-oriented auditors, this agent surfaces **adoption opportunities**, not bugs. A pre-adoption codebase isn't broken — it's pre-adoption. The Health Score reflects adoption progress (NOT ADOPTED → PARTIAL → ADOPTED), and findings are ranked by user-visible impact rather than danger.

## What It Does

- Detects 7 known migration opportunities (legacy `UIBlurEffect`/`NSVisualEffectView`/`.material` on iOS 26+, toolbars without `.borderedProminent` + `Spacer(.fixed)` grouping, custom containers without glass, `.searchable` outside `NavigationSplitView`, `TabView` without `.tabRole(.search)`, nested glass-on-glass layering, `.borderedProminent` without `.tint()`, missing `.interactive()` on custom glass controls)
- Identifies adoption-completeness gaps (every `.glassEffect()` call gated behind `if #available(iOS 26)`, Clear variant chosen for media-overlay surfaces, accessibility contrast re-check after glass adoption, flattened nesting, `.tabRole(.search)` for tab apps, primary-vs-secondary action discipline in toolbars, mixed `.material` + `.glassBackgroundEffect()` reviewed for consistency, snapshot tests on iOS 25 + iOS 26, `.interactive()` on tappable glass, glass-adoption rubric for consistency, pre-iOS-26 fallback design review)
- Correlates findings that compound priority (legacy `.material` + iOS 26+ deployment target = ship-ready migration, glass over media + Regular variant = color distortion, glass adoption + no accessibility re-check = potential WCAG regression, nested glass = visual mud, glass without `#available` gate on lower deployment target = crash risk)
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

- **liquid-glass** skill (axiom-design) — design intent, component guidance, when to use Regular vs Clear variants
- **liquid-glass-ref** skill (axiom-design) — comprehensive app-wide adoption guide and API reference
- **accessibility-auditor** agent — overlaps on contrast regression after glass adoption (re-run after migration)
- **swiftui-performance-analyzer** agent — overlaps on nested-glass frame-time impact on older devices
- **modernization-helper** agent — overlaps on adjacent modernization (`ObservableObject` → `Observable`, `@StateObject` → `@State`)
- **axiom-build** skills — overlaps on deployment-target and availability gating
- **axiom-shipping** skills — overlaps on submission requirements when raising deployment target
- **health-check** agent — includes liquid-glass-auditor in project-wide scans
