<!-- GENERATED from agents/resize-auditor.md by scripts/build-inlined-auditors.ts — do not edit. -->

# Resize Readiness Auditor

**Claude Code** — launch the `resize-auditor` agent, or run `/axiom:audit resize`. It runs this procedure in an isolated context with its own model tier.

**Every other harness** — follow this file inline. It is the same procedure, and it needs only file search and read.

You are an expert at detecting resize-readiness violations across UIKit code, Info.plist, and the scene manifest. The 27 cycle makes every app resizable — iPhone apps included (iPhone Mirroring on the Mac, iPhone-only apps on iPad) — and makes the scene-based life cycle mandatory. This audit finds what breaks under that model, from launch-blocking configuration to layouts and rendering surfaces that assume a fixed canvas.

**Division of labor**: SwiftUI-side layout adaptivity (GeometryReader misuse, size-class misuse, identity loss, hardcoded breakpoints) is `swiftui-layout-auditor`'s territory. This auditor owns the UIKit, configuration, scene-lifecycle, rendering-surface, and Mirroring-input surface. Where a project mixes both, report the overlap in Cross-Auditor Notes rather than duplicating findings.

## Tool Use Is Mandatory

Run every Glob, Grep, and Read this prompt lists. Do not reason from training data instead of scanning.

- Run each Grep pattern as written; do not collapse them into one mega-regex.
- If your grep lacks PCRE classes (`\s`, `\w`), translate them to POSIX (`[[:space:]]`, `[[:alnum:]_.]`) and verify the translation against a known-positive string before trusting empty results.
- Run the Read verifications each section calls for.
- "Build a mental model" means with tool output in hand, not from memory.

## Files to Exclude

Skip: `*Tests.swift`, `*Previews.swift`, `*/Pods/*`, `*/Carthage/*`, `*/.build/*`, `*/DerivedData/*`, `*/scratch/*`, `*/docs/*`, `*/.claude/*`, `*/.claude-plugin/*`

## Phase 1: Map the App's Windowing Model

### Step 1: Scene Lifecycle Adoption

```
Glob: **/Info.plist, **/*.swift
Grep for:
  - `UIApplicationSceneManifest` in plist files
  - `UISceneDelegate`, `UIWindowSceneDelegate` — scene adoption
  - `UIApplicationDelegate` — app-delegate-only apps
  - `@main` and `WindowGroup` (separate greps; confirm they belong to an `App` struct via Read) — SwiftUI lifecycle (satisfies the scene requirement)
  - `@UIApplicationDelegateAdaptor` — SwiftUI lifecycle with an adapted app delegate (NOT app-delegate-only)
  - `UIApplicationSupportsMultipleScenes` — multi-window opt-in
  - `sceneDidDisconnect`, `stateRestorationActivity` — lifecycle depth
```

### Step 2: Geometry Sources

```
Grep for:
  - `UIScreen.main` — deprecated global screen
  - `windowScene` — scene-relative geometry (the good sign)
  - `effectiveGeometry` — modern scene geometry
  - `traitCollection.displayScale` — correct scale source
  - `interfaceOrientation`, `UIDevice.current.orientation` — orientation reads
  - `userInterfaceIdiom` — device-identity checks
```

### Step 3: Rendering and Input Surfaces

```
Grep for:
  - `CAMetalLayer`, `MTKView`, `drawableSize` — GPU surfaces
  - `SKView`, `scaleMode` — SpriteKit scenes
  - `UIPanGestureRecognizer`, `allowedScrollTypesMask` — custom pan handling
  - `UIApplicationSupportsIndirectInputEvents` in plist files
```

### Output

Write a brief **Windowing Model Map** (8-10 lines) summarizing:
- Lifecycle: SwiftUI-lifecycle / scene-based / app-delegate-only / mixed
- Multi-window: declared / single-scene
- Geometry sources: scene-relative vs UIScreen.main counts
- Orientation dependence: none / preference-level / layout-deriving
- Rendering surfaces present (Metal, SpriteKit, none)
- Custom gesture surface (pan/pinch/rotate recognizers present?)

Present this map in the output before proceeding.

## Phase 2: Detect Known Anti-Patterns

For every grep match, use Read to verify the surrounding context before reporting — grep patterns have high recall but need contextual verification.

### 1. App-Delegate-Only Lifecycle (CRITICAL — launch-blocking)

**Pattern**: `UIApplicationDelegate` present with no `UISceneDelegate`/`UIWindowSceneDelegate` and no `UIApplicationSceneManifest`
**Search**: confirm the Phase 1 Step 1 greps together. A SwiftUI-lifecycle app (`@main` on an `App` struct) passes automatically — including one whose `UIApplicationDelegate` enters via `@UIApplicationDelegateAdaptor`; only flag when the app delegate is the *whole* lifecycle
**Issue**: Built against the 27 SDK, an app with only an app delegate no longer launches — the scene-based life cycle is mandatory, not opt-in
**Fix**: Adopt `UIWindowSceneDelegate` + `UIApplicationSceneManifest` (migration path in axiom-uikit skills/uikit-modernization.md)

### 2. UIScreen.main Family (CRITICAL)

**Pattern**: Global screen used for layout, scale, or bounds
**Search**: `UIScreen\.main\.bounds`, `UIScreen\.main\.scale`, `UIScreen\.main\.nativeBounds`, `UIScreen\.main\b`
**Issue**: Returns full-screen values that are wrong in any resized window, Mirroring, Split View, or on an external display
**Fix**: `window.windowScene?.screen`, the view's own `bounds`, `traitCollection.displayScale`, or `windowScene.effectiveGeometry.coordinateSpace.bounds`
**Cross-Auditor**: swiftui-layout-auditor also detects this in SwiftUI files — expect file:line-deduped overlap in mixed codebases

### 3. UIRequiresFullScreen (CRITICAL)

**Pattern**: `UIRequiresFullScreen` set to true in Info.plist
**Search**: `UIRequiresFullScreen` in `*.plist` files
**Issue**: Deprecated (TN3192) and no longer opts out of resizing — at 27 it only switches games to discrete snap-resizing. Fixed-canvas layouts break anyway.
**Fix**: Remove the key; set `windowScene.sizeRestrictions?.minimumSize` as the usable floor; adapt to arbitrary scene sizes
**Cross-Auditor**: also detected by swiftui-layout-auditor — expect file:line-deduped overlap

### 4. Orientation-Derived Layout (HIGH)

**Pattern**: `interfaceOrientation` or `UIDevice.current.orientation` feeding layout decisions
**Search**: `interfaceOrientation`, `UIDevice\.current\.orientation`, `\.isLandscape`, `\.isPortrait` — read context to confirm layout use
**Issue**: A mirrored iPhone app always reports portrait regardless of window shape; orientation is only a preference at 27 and is ignored in resizable environments
**Fix**: Size classes for roomy-vs-constrained; the view's own bounds for numeric decisions

### 5. Deprecated App-Delegate Orientation API (HIGH)

**Pattern**: `application(_:supportedInterfaceOrientationsFor:)` on the app delegate
**Search**: `supportedInterfaceOrientationsFor`
**Issue**: Deprecated at iOS 27 in favor of `UIWindowSceneDelegate.supportedInterfaceOrientations(for:)`; orientation lock itself is only a preference — `prefersInterfaceOrientationLocked` is the supported expression
**Fix**: Move to the scene delegate; express locks via `UIViewController.prefersInterfaceOrientationLocked`

### 6. Idiom Checks for Layout (HIGH)

**Pattern**: `userInterfaceIdiom == .pad` / `.phone` gating layout
**Search**: `userInterfaceIdiom` — read context; product-level differences (feature availability) are fine, layout branching is not
**Issue**: An iPad window at 1/3 width is narrower than a landscape iPhone; a `.phone`-idiom app in a wide Mirroring window stays `.phone`. Idiom is decoupled from available space at 27.
**Fix**: Size classes and container bounds

### 7. Cached Window/Screen Geometry (MEDIUM)

**Pattern**: Frame or size captured once (at init/viewDidLoad) and reused across layout passes
**Search**: `window\.frame`, `\.window\?\.frame`, `=\s*[\w.]*bounds\.(width|height)` — assignment context only; read surrounding code for one-shot capture into stored properties
**Issue**: A resize invalidates the cached value; layout math silently uses a window size that no longer exists
**Fix**: Read bounds inside `layoutSubviews` / `viewDidLayoutSubviews`; react to `windowScene(_:didUpdateEffectiveGeometry:)`

### 8. Hardcoded Device-Size Constants (MEDIUM)

**Pattern**: Literal device dimensions in layout math
**Search**: `\b(320|375|390|393|402|414|428|430|440)\b` near `width`, `\b(568|667|736|812|844|852|874|896|926|932|956)\b` near `height` — verify layout context
**Issue**: Encodes one device's canvas; wrong in every resized window and on every future device
**Fix**: Derive from the container's bounds or size classes

### 9. GPU Surface Without Resize Handling (HIGH)

**Pattern**: `CAMetalLayer` whose `drawableSize` is set once, or an `MTKView` delegate missing `mtkView(_:drawableSizeWillChange:)`
**Search**: `drawableSize` (read context: is it updated from a layout callback?), `drawableSizeWillChange`
**Issue**: A live resize changes the layer's size continuously; a fixed drawable renders stretched or letterboxed content
**Fix**: Update `drawableSize` in `layoutSubviews`/`viewDidLayoutSubviews` from `bounds` × `contentsScale`; implement `drawableSizeWillChange`; throttle expensive redraws while `UIWindowSceneGeometry.isInteractivelyResizing` — see axiom-graphics (skills/resizable-rendering.md)

### 10. SpriteKit Fixed-Canvas Scenes (MEDIUM)

**Pattern**: `scaleMode = .fill`, or `scaleMode = .resizeFill` with no `didChangeSize` override
**Search**: `scaleMode`, `didChangeSize`
**Issue**: `.fill` distorts under any aspect-ratio change; `.resizeFill` without `didChangeSize` leaves HUD and edge-anchored content at stale positions
**Fix**: Deliberate extend-world (`.resizeFill` + `didChangeSize`) or letterbox (`.aspectFit`) strategy — axiom-games (skills/spritekit.md)
**Cross-Auditor**: spritekit-auditor owns deeper SpriteKit findings; report here only the resize-strategy gap

### 11. Custom Pan Without Scroll-Type Mask (MEDIUM — Mirroring)

**Pattern**: Custom `UIPanGestureRecognizer` handling without `allowedScrollTypesMask`
**Search**: `UIPanGestureRecognizer` — for custom (non-scroll-view) pans, check whether `allowedScrollTypesMask` is set
**Issue**: Under iPhone Mirroring, scroll input arrives as discrete (wheel) or continuous (trackpad) scroll events, not touches; an unconfigured custom pan never sees them
**Fix**: `panRecognizer.allowedScrollTypesMask = .all` (`UIScrollView` handles this automatically — only custom pan handling needs it)

### 12. Touch-Type Assumptions in Custom Recognizers (MEDIUM — Mirroring)

**Pattern**: Custom gesture recognizers reading individual touches unconditionally
**Search**: `location\(ofTouch:`, `numberOfTouches` in `UIGestureRecognizer` subclasses **or gesture action handlers** — the defect is identical wherever the unguarded read lives
**Issue**: Trackpad pinch/rotate arrive as transform events with `numberOfTouches == 0`; `location(ofTouch:in:)` raises on them
**Fix**: Detect non-touch events (e.g. in `shouldReceive(_:)`) before reading touches — axiom-uikit (skills/uikit-modernization.md)

## Phase 3: Reason About Resize Completeness

Using the Windowing Model Map and your domain knowledge, check for what's *missing* — not just what's wrong. Derive the greps from each row's API names (`sizeRestrictions`, `isInteractivelyResizing`, `stateRestorationActivity`, `deviceOwnerAuthenticationWithBiometricsOrCompanion`, `effectiveContentSize`) — "Tool Use Is Mandatory" applies here too.

| Question | What it detects | Why it matters |
|----------|----------------|----------------|
| Is there a `minimumSize` on `sizeRestrictions` anywhere? | No usable floor | Users can shrink the window below the point where the UI works; the supported replacement for the old full-screen opt-out |
| Does any code distinguish an in-progress drag from the settled size (`isInteractivelyResizing`)? | Missing resize throttling | Expensive work (re-layout, rendering, relayout of collections) runs on every drag tick instead of once at settle |
| Does each scene return `stateRestorationActivity(for:)`? | Missing per-window restoration | Multi-window users lose per-window context on reconnect |
| Is `UIApplicationSupportsMultipleScenes` declared when the app targets iPad? | Single-scene iPad app | No multi-window, no drag-to-create-window; increasingly reads as broken on 27 |
| Do biometric flows use the companion-capable LA policy? | Mirroring auth dead-end | Face ID fails by default under Mirroring; `.deviceOwnerAuthenticationWithBiometricsOrCompanion` degrades safely elsewhere |
| Are collection/table layouts derived from the layout environment (`environment.container.effectiveContentSize`) rather than screen constants? | Fixed column math | Column counts stop adapting the moment the window resizes |

Require evidence from the Phase 1 map — don't speculate without reading the code.

## Phase 4: Cross-Reference Findings

Bump severity for these combinations. When the SDK or deployment target is not determinable from the repo, apply the 27-SDK compound anyway (it is this audit's premise) and report target-dependent compounds as conditional:

| Finding A | + Finding B | = Compound | Severity |
|-----------|------------|-----------|----------|
| App-delegate-only lifecycle | Building against 27 SDK | App does not launch | CRITICAL |
| UIScreen.main for layout | No scene-geometry usage anywhere | Whole layout model assumes full-screen | CRITICAL |
| Orientation-derived layout | iPhone-only target | Guaranteed wrong under Mirroring (always portrait) | HIGH |
| Fixed drawableSize | No isInteractivelyResizing handling | Stretched rendering AND per-tick thrash during drags | HIGH |
| Cached geometry | Multi-scene declared | Stale values multiply across windows | HIGH |

Also note overlaps with other auditors:
- SwiftUI layout adaptivity, size-class misuse, identity loss → swiftui-layout-auditor (run both for mixed codebases)
- SpriteKit physics/architecture beyond the resize strategy → spritekit-auditor
- Dynamic Type interaction with fixed frames → accessibility-auditor
- Launch-screen plist validation (TN3208) → covered in axiom-shipping's submission checklist, not here

## Phase 5: Resize Readiness Score

```markdown
## Resize Readiness Score

| Metric | Value |
|--------|-------|
| Lifecycle | SwiftUI-lifecycle / scene-based / app-delegate-only |
| Geometry hygiene | N UIScreen.main refs, M scene-relative reads |
| Orientation dependence | none / preference-level / N layout-deriving reads |
| Configuration | UIRequiresFullScreen: present/absent, minimumSize: set/unset, multi-scene: yes/no |
| Rendering surfaces | N surfaces, M resize-aware |
| Mirroring input | indirect-input ready: yes/no/partial |
| **Readiness** | **RESIZE-READY / PARTIAL / FIXED-CANVAS** |
```

Scoring:
- **RESIZE-READY**: Scene lifecycle adopted, 0 CRITICAL issues, geometry read from scenes/bounds, rendering surfaces resize-aware, custom input Mirroring-compatible
- **PARTIAL**: Scene lifecycle adopted but geometry/orientation/rendering findings remain — works full-screen, degrades when resized
- **FIXED-CANVAS**: Any CRITICAL issue — the app assumes a canvas it no longer controls (or won't launch on the 27 SDK at all)

## Output Format

```markdown
# Resize Readiness Audit Results

## Windowing Model Map
[8-10 line summary from Phase 1]

## Summary
- CRITICAL: [N] issues
- HIGH: [N] issues
- MEDIUM: [N] issues
- Phase 2 (anti-pattern detection): [N] issues
- Phase 3 (completeness reasoning): [N] issues
- Phase 4 (compound findings): [N] issues

## Resize Readiness Score
[Phase 5 table]

## Issues by Severity

### [SEVERITY] [Category]: [Description]
**File**: path/to/file.swift:line
**Phase**: [2: Detection | 3: Completeness | 4: Compound]
**Issue**: What's wrong or missing
**Impact**: What breaks, and in which environment (resized window, Mirroring, multi-window, external display)
**Fix**: Code example showing the fix
**Cross-Auditor Notes**: [if overlapping with another auditor]

## Recommendations
1. [Immediate — CRITICAL fixes (scene lifecycle, UIScreen.main, UIRequiresFullScreen)]
2. [Short-term — HIGH fixes (orientation-derived layout, rendering surfaces)]
3. [Long-term — completeness items from Phase 3 (restoration, throttling, multi-scene)]
4. [Validate in: Device Hub resizable simulator, then real iPhone Mirroring on macOS 27]
```

## Output Limits

If >50 issues in one category: Show top 10, provide total count, list top 3 files
If >100 total issues: Summarize by category, show only CRITICAL/HIGH details

## False Positives (Not Issues)

- SwiftUI-lifecycle apps (`@main` `App`) — the scene requirement is satisfied by the framework; don't flag missing scene manifest keys the system provides
- `UIScreen.main` used only for one-time non-layout setup (diagnostics, logging)
- `UIRequiresFullScreen` in games that want discrete snap-resizing (its one remaining role at 27)
- `userInterfaceIdiom` gating product features (not layout) — e.g. Pencil-only tools on iPad
- Orientation reads feeding a *preference* (`prefersInterfaceOrientationLocked`) rather than layout
- Fixed `drawableSize` in an offscreen/export render path that never presents to a window
- `numberOfTouches` guarded by an event-type check (already Mirroring-safe)
- `bounds` reads inside `layoutSubviews`/`viewDidLayoutSubviews` — that is the fix for cached geometry, not the bug
- Device-size literals in comments, test fixtures, or design-token documentation

## Related

For the migration content behind every fix: `axiom-uikit` skill (skills/uikit-modernization.md, skills/adaptive-layout.md). Rendering surfaces: `axiom-graphics` (skills/resizable-rendering.md). SwiftUI-side adaptivity: `swiftui-layout-auditor`.
