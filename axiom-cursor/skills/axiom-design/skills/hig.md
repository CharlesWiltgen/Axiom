
# Apple Human Interface Guidelines — Quick Reference

## When to Use This Skill

Use when:
- Making visual design decisions (colors, backgrounds, typography)
- Reviewing UI for HIG compliance
- Answering "Should I use a dark background?"
- Choosing between design options
- Defending design decisions to stakeholders
- Quick lookups for common design questions

#### Related Skills
- Use `axiom-design (skills/hig-ref.md)` for comprehensive details and code examples
- Use `axiom-design (skills/liquid-glass.md)` for iOS 26 material design implementation and version-conditional design (supporting both pre-Liquid Glass and Liquid Glass in the same app)
- Use `axiom-design (skills/liquid-glass-ref.md)` for iOS 26 app-wide adoption guide with backward compatibility strategy
- Use `axiom-accessibility` for accessibility troubleshooting

#### Version-Conditional Design
When supporting both iOS 25 (pre-Liquid Glass) and iOS 26+, see `axiom-design (skills/liquid-glass.md)` for the adoption strategy — it covers when to use `#available(iOS 26, *)`, how to degrade gracefully, and which system components adopt Liquid Glass automatically vs which need explicit opt-in.

---

## Quick Decision Trees

### Background Color Decision

```
Is your app media-focused (photos, videos, music)?
├─ Yes → Consider permanent dark appearance
│        WHY: "Lets UI recede, helps people focus on media" (Apple HIG)
│        EXAMPLES: Apple Music, Photos, Clock apps use dark
│        CODE: .preferredColorScheme(.dark) on root view
│
└─ No → Use system backgrounds (respect user preference)
         CODE: systemBackground (adapts to light/dark automatically)
         GROUPED: systemGroupedBackground for iOS Settings-style lists
```

**Apple's guidance:** "In rare cases, consider using only a dark appearance in the interface. For example, it can make sense for an app that enables immersive media viewing to use a permanently dark appearance."

### Color Selection Decision

```
Do you need a specific color value?
├─ No → Use semantic colors
│        label, secondaryLabel, tertiaryLabel, quaternaryLabel
│        systemBackground, secondarySystemBackground, tertiarySystemBackground
│        WHY: Automatically adapts to light/dark/high contrast
│
└─ Yes → Create Color Set in asset catalog
         1. Open Assets.xcassets
         2. Add Color Set
         3. Configure variants:
            ├─ Light mode color
            ├─ Dark mode color
            └─ High contrast (optional but recommended)
```

**Key principle:** "Use semantic color names like labelColor that automatically adjust to the current interface style."

### Font Weight Decision

```
Which font weight should I use?
├─ ❌ AVOID: Ultralight, Thin, Light
│            WHY: Legibility issues, especially at small sizes
│
├─ ✅ PREFER: Regular, Medium, Semibold, Bold
│             WHY: Maintains legibility across sizes and conditions
│
└─ Headers: Semibold or Bold for hierarchy
            Body: Regular or Medium
```

**Apple's guidance:** "Avoid light font weights. Prefer Regular, Medium, Semibold, or Bold weights instead of Ultralight, Thin, or Light."

---

## Core Principles Checklist

### Before Shipping Any UI

**Verify every screen passes these checks:**

#### Appearance
- [ ] Works in Light Mode
- [ ] Works in Dark Mode
- [ ] Passes with Increased Contrast enabled
- [ ] Passes with Reduce Transparency enabled

#### Typography
- [ ] Supports Dynamic Type (text scales to 200%)
- [ ] No light font weights (Regular minimum)
- [ ] Hierarchy clear at all text sizes
- [ ] No truncation at large text sizes

#### Accessibility
- [ ] Contrast ratio ≥ 4.5:1 minimum
- [ ] Contrast ratio ≥ 7:1 for small text (recommended)
- [ ] Touch targets ≥ 44x44 points
- [ ] Information conveyed by more than color alone
- [ ] VoiceOver labels for all interactive elements

#### Motion
- [ ] Respects Reduce Motion setting
- [ ] Animations can be canceled/skipped
- [ ] No auto-playing video without controls

#### Localization
- [ ] No hardcoded strings in images
- [ ] Right-to-left language support
- [ ] Proper text directionality

---

## Common Design Questions

### Q: Should my app have a dark background?

**A:** Only for media-focused apps (photos, videos, music) where content should be the hero. Use system backgrounds for everything else.

**Apple's own apps:**
| App | Background | Reason |
|-----|------------|--------|
| Music | Dark | Album art is focus |
| Photos | Dark | Images are hero |
| Clock | Dark | Nighttime use |
| Notes | System | Document editing |
| Settings | System | Utilitarian |

**Code:**
```swift
// ❌ WRONG - Don't override unless media-focused
.background(Color.black)

// ✅ CORRECT - Let system decide
.background(Color(.systemBackground))
```

### Q: What's the right background color?

**A:** Use `systemBackground` which adapts to light/dark automatically. For grouped content (like iOS Settings), use `systemGroupedBackground`.

**Color hierarchy:**
- Primary: `systemBackground` - Main background
- Secondary: `secondarySystemBackground` - Grouping elements
- Tertiary: `tertiarySystemBackground` - Grouping within secondary

```swift
// ✅ Standard list
List { }
    .background(Color(.systemBackground))

// ✅ Grouped list (Settings style)
List { }
    .listStyle(.grouped)
    .background(Color(.systemGroupedBackground))
```

### Q: How do I ensure legibility?

**A:** Use semantic label colors, maintain 4.5:1 contrast, avoid light font weights.

**Label hierarchy:**
```swift
// Most prominent
Text("Title").foregroundStyle(.primary)

// Subtitles
Text("Subtitle").foregroundStyle(.secondary)

// Tertiary information
Text("Detail").foregroundStyle(.tertiary)

// Disabled text
Text("Disabled").foregroundStyle(.quaternary)
```

### Q: Should I use SF Symbols or custom icons?

**A:** SF Symbols unless you need brand-specific imagery. They scale with Dynamic Type and adapt to appearance automatically.

**Benefits of SF Symbols:**
- 5,000+ symbols included (SF Symbols 5)
- Automatic light/dark adaptation
- Scale with Dynamic Type
- Become bolder with Bold Text accessibility
- Nine weights matching San Francisco font

**When to use custom:**
- Brand-specific imagery
- App-specific concepts not in SF Symbols
- Unique visual style requirement

### Q: Light/Dark Mode or user choice?

**A:** Always support both. Never create app-specific appearance settings.

**Apple's guidance:** "Avoid creating app-specific appearance settings. Users expect apps to honor their systemwide Dark Mode choice. An app-specific appearance mode option creates more work for people because they have to adjust more than one setting to get the appearance they want."

### Q: What contrast ratio do I need?

**A:** 4.5:1 minimum for normal text, 7:1 recommended for small text.

**WCAG Contrast Standards:**
- **AA (required):** 4.5:1 for normal text, 3:1 for large text (18pt+/14pt+ bold)
- **AAA (enhanced):** 7:1 for normal text, 4.5:1 for large text
- **Apple guidance:** Use semantic colors which automatically meet AA requirements

**Testing:** Use online contrast calculators or Xcode's Accessibility Inspector.

### Q: What's the minimum touch target size?

**A:** 44x44 points on iOS/iPadOS, with spacing between targets.

**Platform-specific:**
- iOS/iPadOS: 44x44 points minimum
- macOS: 20x20 points minimum; larger for primary actions
- watchOS: Use system controls (optimized for small screen)
- tvOS: give focusable elements room to grow when focused; HIG's published tvOS figure is a safe-area content inset (60pt top/bottom, 80pt sides), not a focus-spacing minimum

### Q: What spacing, padding, or margin value should I use?

**A:** None — omit the length and let the system supply it.

Apple's HIG Layout guidance publishes no iOS spacing scale. It says to respect "system-defined safe areas, margins, and guides" and let the interface adapt. The SDK encodes that rule in the type signatures: every SwiftUI spacing modifier takes an **optional** length, and `nil` means system-determined.

```swift
// From SwiftUICore.swiftinterface — the length is Optional, defaulting to nil
public func padding(_ edges: Edge.Set = .all, _ length: CGFloat? = nil) -> some View
```

```swift
// ❌ WRONG — invents values Apple never published; won't adapt
VStack(spacing: 12) { … }
    .padding(.horizontal, 20)

// ✅ RIGHT — system decides, and adapts across platform, size class, and Dynamic Type
VStack { … }
    .padding(.horizontal)
```

**System-spacing APIs.** All of them type the length as `CGFloat?`, where `nil` means system-determined — but only two *default* it, so the rest still require the argument. Pass `nil` explicitly there; it is not the same as committing to a number.

| API | How to get the system value | Use for |
|-----|------------------------------|---------|
| `.padding(_:_:)` | omit the length | general spacing around a view |
| `.safeAreaPadding(_:_:)` | omit the length | spacing measured beyond the safe area, not from the view edge |
| `.contentMargins(_:_:for:)` | pass `nil` | scroll content insets, independent of scroll indicators |
| `.listRowInsets(_:_:)` | pass `nil` | per-row insets in a `List` |
| `.listSectionMargins(_:_:)` | pass `nil` | `List` section margins (iOS 26+; iOS/visionOS only — unavailable on macOS, tvOS, watchOS) |
| `VStack`/`HStack` | omit `spacing:` | system default inter-view spacing |
| `Grid` | omit `horizontalSpacing:`/`verticalSpacing:` | system default grid gutters |

`.contentMargins(.horizontal)` does not compile — with the length omitted the call resolves to the single-`CGFloat` overload and `.horizontal` is not a `CGFloat`. Write `.contentMargins(.horizontal, nil)`.

UIKit equivalents: `layoutMarginsGuide`, `directionalLayoutMargins`, `readableContentGuide` (caps line length for readability).

**When a literal is legitimate.** Three cases, and all of them are exceptions you justify, not defaults:
- Implementing a design system that defines its own scale — then the scale lives in one place, not scattered at call sites
- Optical correction where the system value is demonstrably wrong for a specific glyph or asset
- Non-standard canvases (games, custom drawing) that aren't participating in system layout

If you type a number, leave a comment saying which system value was wrong and why. A bare literal is indistinguishable from a guess.

**Where the published numbers actually live.** Apple's concrete values are platform-specific, never a general scale. 44x44pt touch targets come from accessibility and controls guidance (see the touch-target question above). Layout guidance itself publishes exactly two figures, both non-iOS: tvOS safe-area content insets (*"Inset primary content 60 points from the top and bottom of the screen, and 80 points from the sides"*) and visionOS button separation (*"place buttons so their centers are at least 60 points apart"*). There is no published iOS spacing scale — which is the whole reason the rule above is "omit the length".

### Q: Should this list have a section index (the A–Z strip on the trailing edge)?

**A:** Only if the list is long, sorted, and people scan it by letter — contacts, songs, a music library. An index over a short or unsorted list is decoration that steals a thumb-width of the trailing edge.

**The hard rule:** never put an index on a list whose rows carry trailing controls — disclosure indicators, chevrons, detail buttons. Apple's guidance is explicit that both occupy the trailing side and *"it can be difficult for people to use one element without activating the other."*

**You usually don't have to choose.** The conflict is with the *chevron*, not with push navigation. `.navigationLinkIndicatorVisibility(.hidden)` hides the indicator while the row stays a `NavigationLink` — it still pushes and still announces as a link to VoiceOver. Apple's own Contacts app is exactly this: A–Z index, push-to-detail, no chevrons. Only when a row genuinely needs a *tappable* trailing control (a detail button, a favorite toggle) is it a real either/or, and then the index is the thing that goes.

**Also worth knowing before you design around it:**
- The index shows only sections that have an index label, so it doesn't have to be a complete alphabet
- watchOS renders it as a transient label beside the scroll indicator during crown scrolling, not a persistent strip — don't design a watch layout that assumes the iOS presentation
- macOS and tvOS have no section index at all

For the SwiftUI API (`sectionIndexLabel`, `listSectionIndexVisibility`, and the availability asymmetry between them), see axiom-swiftui (skills/26-ref.md), "Section Index".

---

## Design Review Checklist

### When Reviewing Any Design

Use this checklist for design reviews, App Store submissions, or stakeholder presentations:

#### Content-First Design
- [ ] Does UI defer to content? (Not competing for attention)
- [ ] Is branding restrained? (No logo on every screen)
- [ ] Are backgrounds content-appropriate? (Media apps dark, others system)

#### Platform Consistency
- [ ] Does it feel native to iOS/iPad/Mac?
- [ ] Uses system colors and fonts?
- [ ] Standard gestures work as expected?
- [ ] Navigation patterns familiar?

#### Accessibility Compliance
- [ ] All contrast ratios meet requirements?
- [ ] All touch targets ≥ 44x44 points?
- [ ] Information conveyed beyond color?
- [ ] VoiceOver labels complete?
- [ ] Dynamic Type supported?

#### Light & Dark Modes
- [ ] Works in both appearance modes?
- [ ] Colors adapt automatically?
- [ ] No hardcoded color values?
- [ ] Increased Contrast tested?

#### Localization-Ready
- [ ] No hardcoded strings in images?
- [ ] RTL language support?
- [ ] Text doesn't truncate?
- [ ] Layouts adapt to text size?

---

## Design Review Pressure: Defending HIG Decisions

### The Problem

In design reviews, you'll hear:
- "Let's add our logo to every screen for brand consistency"
- "Use light font weights—they look more elegant"
- "Make a custom appearance toggle—some users prefer dark"
- "This screen needs a splash screen for our brand"

These violate HIG. Here's how to push back professionally.

### Red Flags — Requests That Violate HIG

If you hear ANY of these, **reference this skill**:

- ❌ **"Add logo to navigation bar"** — Wastes space, distracts from content
- ❌ **"Use Ultralight font"** — Legibility issues, fails accessibility
- ❌ **"Custom dark mode toggle"** — Creates more work for users, ignores system preference
- ❌ **"Splash screen for branding"** — Launch screens can't include branding
- ❌ **"Custom brand color for all text"** — May fail contrast requirements

### How to Push Back Professionally

#### Step 1: Show the HIG Guidance

```
"I want to make this change, but let me show you Apple's guidance:

[Show the relevant HIG section from this skill or hig-ref]

Apple explicitly recommends against this because..."
```

#### Step 2: Demonstrate the Risk

**For contrast issues:**
- Show the design at 4.5:1 contrast (passing)
- Show their proposal (failing)
- Explain App Store rejection risk

**For appearance toggles:**
- Show iOS Settings → Display & Brightness
- Explain users already have this control
- Demonstrate confusion of two separate settings

#### Step 3: Offer Compromise

```
"I understand the brand concern. Here are HIG-compliant alternatives:

1. Use your brand color as the app's tint color
2. Feature branding in onboarding (not launch screen)
3. Use your accent color for primary actions
4. Include subtle branding in content, not chrome"
```

#### Step 4: Document the Decision

If overruled:

```
Slack message to PM + designer:

"Design review decided to [violate HIG guidance].

Important risks to monitor:
- App Store rejection (HIG violations)
- Accessibility issues (users with visual impairments)
- User complaints (departure from platform norms)

I'm flagging this proactively. If we see issues after launch,
we'll need an expedited follow-up."
```

### When to Accept the Design Decision

Sometimes designers have valid reasons to override HIG. Accept if:

- [ ] They understand the HIG guidance
- [ ] They're willing to accept rejection/accessibility risks
- [ ] You document the decision in writing
- [ ] They commit to monitoring post-launch feedback

---

## Three Core HIG Principles

Every design decision should support these principles:

### 1. Clarity

**Definition:** Content should be paramount, interface elements should defer to content.

**In practice:**
- White space is your friend
- Every element has a purpose
- Remove anything that doesn't serve the user
- Users should know what they can do without instructions

### 2. Consistency

**Definition:** Use standard UI elements and familiar patterns.

**In practice:**
- Standard gestures work as expected
- Navigation follows platform conventions
- Colors and fonts use system values
- Familiar components in familiar locations

### 3. Deference

**Definition:** UI shouldn't compete with content for attention.

**In practice:**
- Subtle backgrounds, not bold
- Navigation recedes when not needed
- Content is the hero
- Branding is restrained

**From HIG:** "Deference makes an app beautiful by ensuring the content stands out while the surrounding visual elements do not compete with it."

---

## Platform-Specific Quick Tips

### iOS
- Portrait-first design
- One-handed reachability
- Bottom tab bar for primary navigation
- Swipe back gesture

### iPadOS
- Sidebar-adaptable layouts
- Split view support
- Pointer interactions
- Arbitrary window sizing (iOS 26+)

### macOS
- Menu bar for commands
- Dense layouts acceptable
- Pointer-first interactions
- Window chrome and controls

### watchOS
- Glanceable interfaces
- Full-bleed content
- Minimal padding
- Digital Crown interactions

### tvOS
- Focus-based navigation
- 10-foot viewing distance
- Large touch targets
- Gestural remote

### visionOS
- Spatial layout
- Glass materials
- Comfortable viewing depth
- Avoid head-anchored content

---

## Payments

Apple Pay, Wallet, and Tap to Pay each have their own HIG with rules App Review enforces. The discipline lives in `axiom-payments`:

- **Apple Pay button + Apple Pay Mark + payment-sheet UX** → `axiom-payments/skills/apple-pay.md` § "Apple Pay Mark vs Apple Pay Button" + `apple-pay-web.md` § "Acceptable Use Guidelines" (parity rule)
- **Wallet pass design** (image specs, Apple Watch layout, semantic tags, poster event ticket iOS 18+) → `axiom-payments/skills/wallet-passes.md` § "iOS 18 Poster Event Ticket Migration" + `wallet-passes-ref.md` image table
- **Tap to Pay on iPhone** (button label, T&C flow, progress indicator, generic labels for non-payment uses) → `axiom-payments/skills/tap-to-pay.md` § "Checkout UX"

## Resources

**WWDC**: 356, 2019-808

**Docs**: /design/human-interface-guidelines, /design/human-interface-guidelines/layout, /design/human-interface-guidelines/lists-and-tables, /design/human-interface-guidelines/color, /design/human-interface-guidelines/dark-mode, /design/human-interface-guidelines/typography, /design/human-interface-guidelines/apple-pay, /design/human-interface-guidelines/wallet, /design/human-interface-guidelines/tap-to-pay-on-iphone

**Skills**: axiom-design (skills/hig-ref.md), axiom-design (skills/liquid-glass.md), axiom-design (skills/liquid-glass-ref.md), axiom-swiftui (skills/26-ref.md), axiom-accessibility, axiom-payments

---

**Last Updated**: Based on Apple HIG (2024-2025), WWDC25-356, WWDC19-808
**Skill Type**: Discipline (Quick decisions, checklists, pressure scenarios)
