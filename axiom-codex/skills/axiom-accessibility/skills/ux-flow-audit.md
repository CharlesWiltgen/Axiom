
# UX Flow Audit

**UX issues are not polish — they're defects that cause support tickets, bad reviews, and user churn.**

Axiom's code-level auditors check patterns. This skill checks what users actually experience: Can they complete their task? Can they get back? Do they know what's happening?

## 6 iOS UX Principles (Detection Anchors)

These principles anchor every detection category. When a principle is violated, users get stuck, confused, or frustrated.

### 1. Honor the Promise

What the button/title says must match what the user gets. A "Settings" button that opens a profile page breaks trust.

### 2. Escape Hatch

Every modal (sheet, fullScreenCover, alert) must have a way out. A sheet without a dismiss button or drag-to-dismiss traps users.

### 3. Primary Action Visibility

The main thing users came to do must be immediately visible and tappable. If the CTA requires scrolling or menu-diving, users won't find it.

### 4. Dead End Prevention

Every view must have a forward path (next step) or a completion state (success message, return to start). A view with no actions and no navigation is a dead end.

### 5. Progressive Disclosure

Don't overwhelm on first screen. Show essentials first, details on demand. An onboarding flow that dumps 12 settings on page one loses users.

### 6. Feedback Loop

Users must know what's happening during async operations. No loading state = "is it broken?" No error state = "what went wrong?" No empty state = "is this feature missing?"

## Detection Categories

**8 Core Defects** (always check — these are UX bugs, not opinions):

1. Dead-End Views (CRITICAL)
2. Dismiss Traps (CRITICAL)
3. Buried CTAs (HIGH)
4. Promise-Scope Mismatch (HIGH)
5. Deep Link Dead Ends (HIGH)
6. Missing Empty States (HIGH)
7. Missing Loading/Error States (HIGH)
8. Accessibility Dead Ends (HIGH)

**3 Contextual Checks** (check when product context warrants — these involve design judgment):

9. Onboarding Gaps (MEDIUM) — requires knowing the product's onboarding strategy
10. Broken Data Paths (MEDIUM) — overlaps with code correctness; include only when UX-visible
11. Platform Parity Gaps (MEDIUM) — depends on target device strategy

Core defects are always worth reporting. Contextual checks require product knowledge — flag them if they look wrong, but acknowledge they may be intentional decisions.

### 1. Dead-End Views (CRITICAL)

Views with no navigation forward, no actions, and no completion state.

**Detect**:
- SwiftUI: Views with no `NavigationLink`, `Button`, `.sheet`, `.fullScreenCover`, `.navigationDestination`, or dismiss action
- UIKit: View controllers with no `IBAction`, no `addTarget`, no navigation push/present calls, no `UIBarButtonItem`
- Check for views/VCs that are navigation destinations but offer no way to proceed or return

**Common cause**: Placeholder views during development that ship to production.

### 2. Dismiss Traps (CRITICAL)

Sheets or fullScreenCover without a dismiss path.

**Detect**:
- SwiftUI: `.fullScreenCover` without `@Environment(\.dismiss)` or explicit dismiss button; `.sheet` with `.interactiveDismissDisabled(true)` without alternative dismiss; alert/confirmation dialogs missing cancel actions
- UIKit: `present(_:animated:)` with `modalPresentationStyle = .fullScreen` where presented VC has no dismiss/close button; `isModalInPresentation = true` without alternative dismiss path

**Why critical**: Users literally cannot leave the screen. The only escape is force-quitting the app.

### 3. Buried CTAs (HIGH)

Primary actions hidden below fold, in menus, or behind navigation.

**Detect**:
- Primary action buttons placed after long `ScrollView` content
- Important actions only in `.toolbar` overflow menu (`.secondaryAction`)
- CTAs inside expandable `DisclosureGroup` sections
- No prominent action on the main tab's root view

**Not a buried CTA**: Below-fold placement that is intentional — checkout confirmation ("review order then confirm"), terms acceptance ("read then agree"), or content that the user should see before acting. The test: is the below-fold placement serving the user (they need context first) or hurting them (they can't find the action)?

### 4. Promise-Scope Mismatch (HIGH)

NavigationTitle, button label, or tab name doesn't match the content.

**Detect**:
- `.navigationTitle("X")` where view content is clearly about Y
- `NavigationLink("Settings")` that navigates to a profile/account view
- Tab labels that don't match tab content
- Button text suggesting one action but performing another

### 5. Deep Link Dead Ends (HIGH)

URL opens but lands on empty or broken state.

**Detect**:
- `.onOpenURL` handlers that push a view without checking if data exists
- Deep link destinations that assume pre-loaded state
- Universal link handling that doesn't validate the entity ID
- No fallback when deep-linked content is unavailable

**Cross-reference**: `axiom-swiftui` (navigation reference) covers deep link architecture. This category checks the UX outcome.

### 6. Missing Empty States (HIGH)

Lists, grids, or content views with no data show blank screen.

**Detect**:
- `List` or `ForEach` without `if items.isEmpty { ... }` or `.overlay` for empty state
- `@Query` results displayed without empty check
- Search results with no "no results" view
- Filtered views that can reach zero items

### 7. Missing Loading/Error States (HIGH)

Async operations with no feedback.

**Detect**:
- SwiftUI: `.task { }` or `Task { }` that fetches data without a loading indicator; `try await` without error presentation (no `.alert`, no error state variable); state enum missing `.loading` or `.error` cases
- UIKit: `URLSession` calls without `UIActivityIndicatorView` or progress UI; completion handlers that don't update UI on error; missing `UIAlertController` for failure cases
- Both: Network calls without timeout or retry UI
- Both: `catch` blocks that only `print`/log in `#if DEBUG` with no user-visible feedback — the user sees the operation silently fail

**Focus on network/write operations**: Skip loading indicators for fast local reads (GRDB queries, UserDefaults, cached data) that complete in under 100ms — adding spinners to these creates visual flicker. Focus on network calls, database writes, and any operation that can meaningfully fail.

**Scan systematically**: When you find a silent-error pattern in one file (e.g., `catch { print(...) }` without user feedback), scan ALL similar files for the same pattern. A single catch-block issue usually indicates a codebase-wide habit.

### 8. Accessibility Dead Ends (HIGH)

Actions only reachable via gestures or visual cues, invisible to assistive technology.

**Detect**:
- `.onLongPressGesture` / `.swipeActions` / `DragGesture` without `.accessibilityAction` equivalent
- Custom controls without `.accessibilityLabel` or `.accessibilityHint`
- Navigation that depends on color alone (e.g., "tap the green button")
- Pull-to-refresh (`refreshable`) without VoiceOver-accessible alternative (note: `refreshable` is automatically accessible — check custom implementations)

**Cross-reference**: `skills/accessibility-diag.md` covers full WCAG compliance. This category specifically checks UX flow reachability from assistive technology.

### 9. Onboarding Gaps (MEDIUM)

First-launch flow that's incomplete or overwhelming.

**Detect**:
- No `@AppStorage`-gated onboarding check
- Onboarding flow without skip/later option
- More than 5 onboarding screens
- Onboarding that requires account creation before showing app value

### 10. Broken Data Paths (MEDIUM)

State/binding wiring issues that manifest as UX problems (view shows stale data, edits don't save, view appears empty when data exists).

**Detect**:
- Views accepting `@Binding` that are initialized with `.constant()` in non-preview code
- Views expecting `@Environment` values not provided by ancestors
- `@Observable` models created locally when they should be injected
- `@State` used where `@Binding` should propagate changes upward

**Scope note**: This overlaps with general SwiftUI correctness (`axiom-swiftui`, debugging reference). Include findings here only when the broken data path causes a visible UX problem — blank screen, stale content, edits that don't persist. Skip compiler-level or crash-level issues that belong in code review.

### 11. Platform Parity Gaps (MEDIUM)

iPad sidebar missing, landscape broken, Mac Catalyst issues.

**Detect**:
- `NavigationStack` without `NavigationSplitView` alternative for iPad
- No `.horizontalSizeClass` checks for adaptive layout
- Views that break in landscape (fixed heights, no scroll)
- Missing keyboard shortcut support on iPad/Mac

## Audit Process

### Step 1: Map Entry Points

Find all ways users enter the app:
- `@main` App struct / SceneDelegate
- `.onOpenURL` handlers (deep links)
- Widget `Link` destinations
- Notification response handlers (`UNUserNotificationCenterDelegate`)
- Spotlight/Siri intent handlers

### Step 2: Map Navigation Containers

Find all navigation structure:
- `NavigationStack` / `NavigationSplitView`
- `TabView` with tab structure
- `.sheet` / `.fullScreenCover` presentations
- Custom modal presentations

### Step 3: Trace Flows

For each entry point → completion path:
1. Can the user reach their goal?
2. Can the user get back?
3. Does the user know what's happening at each step?

### Step 4: Check Data Wiring

- Are `@Binding` vars actually passed from parent?
- Are `@Observable` objects injected via environment?
- Are `@Query` results handled for empty case?

### Step 5: Check Platform Adaptivity

- iPad: Does sidebar/split view work?
- Landscape: Does layout adapt?
- Mac Catalyst/Designed for iPad: Do keyboard shortcuts exist?

### Step 6: Check Accessibility Flows

- Can VoiceOver users complete every flow?
- Are gesture-only actions backed by accessibility actions?

## Cross-Auditor Correlation

When findings overlap with other Axiom auditors, note the correlation and elevate severity:

| UX Finding | Overlapping Auditor | Compound Effect | Severity Bump |
|------------|-------------------|-----------------|---------------|
| Dead end + missing NavigationPath | swiftui-nav-auditor | Programmatic fix impossible | CRITICAL |
| Gesture-only action + no `.accessibilityAction` | accessibility-auditor | Dead end for VoiceOver users | CRITICAL |
| Missing loading state + unhandled async error | concurrency-auditor | Crash + no user feedback | CRITICAL |
| Missing empty state + @Query with no results | swiftdata-auditor | Blank screen after data migration | HIGH |
| Deep link dead end + no URL validation | swiftui-nav-auditor | Silent failure from external link | HIGH |

## Output Format

### Enhanced Rating Table (for CRITICAL and HIGH findings)

| Finding | Urgency | Blast Radius | Fix Effort | ROI |
|---------|---------|-------------|-----------|-----|
| Dead-end after payment | Ship-blocker | All users | 30 min | Critical |
| Missing empty state on search | Next release | Users who search | 15 min | High |

**Urgency**: Ship-blocker / Next release / Backlog
**Blast Radius**: All users / Specific flow / Edge case
**Fix Effort**: Time estimate for the fix
**ROI**: Computed from urgency x blast radius / effort

### Navigation Reachability Score

At end of audit, output:

```
## Navigation Reachability

- Total screens found: [N] (views with navigation presentation)
- Deep-linkable screens: [N] (.onOpenURL can reach them)
- Widget-reachable screens: [N] (widget Link destinations)
- Notification-reachable screens: [N] (notification handlers)
- Coverage: [N]% of screens are externally reachable
```

## Fix Effort Reality Check

Most UX flow defects are fast fixes. When someone says "that's a big change," check this table:

| Defect | Typical Fix | Time |
|--------|------------|------|
| Dismiss trap (no close button) | Add toolbar Cancel button + `dismiss()` | 10-15 min |
| Missing empty state | Add `if items.isEmpty { ContentUnavailableView(...) }` | 15-20 min |
| Buried CTA (placement change) | Move button from `.secondaryAction` to `.primaryAction` | 20-30 min |
| Dead-end view (no forward path) | Add NavigationLink or action button | 15-30 min |
| Missing loading state | Add `@State var isLoading` + ProgressView overlay | 15-20 min |
| Silent error (no user feedback) | Add `.alert` presentation on catch block | 10-15 min |
| Gesture-only action | Add `.accessibilityAction` + visible button alternative | 15-20 min |

**The cost of NOT fixing**: A dismiss trap or dead end after payment generates 1-star reviews within hours of launch. Each review costs 10-20 positive reviews to offset. The 15-minute fix prevents weeks of damage control.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "UX issues are just polish, we'll fix later" | UX dead ends cause 1-star reviews. They're defects, not enhancements. A 15-min fix now prevents weeks of damage control. |
| "Users will figure it out" | Users don't figure it out. They delete the app. Average user tries for 30 seconds. |
| "We'll add empty states after launch" | Empty states are the FIRST thing new users see. Launching without them means launching broken. |
| "That fix is a big design change" | Most UX fixes are placement or state changes (10-30 min). Check the Fix Effort table above. |
| "Accessibility is a separate concern" | If VoiceOver users can't complete a flow, it's a dead end. Same defect, different user. |
| "This screen is just temporary" | Temporary screens ship. Check them anyway. |
| "The dismiss gesture handles it" | fullScreenCover has no dismiss gesture. That's the trap. |

## Resources

**Skills**: axiom-swiftui, skills/accessibility-diag.md, axiom-design (skills/hig.md)

**Agents**: ux-flow-auditor (automated scanning), swiftui-nav-auditor (navigation architecture), accessibility-auditor (WCAG compliance)
