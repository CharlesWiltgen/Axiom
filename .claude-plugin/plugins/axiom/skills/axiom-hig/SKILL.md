---
name: axiom-hig
description: Use when making design decisions, reviewing UI for HIG compliance, choosing colors/backgrounds/typography, or defending design choices - quick decision frameworks and checklists for Apple Human Interface Guidelines
license: MIT
compatibility: iOS, iPadOS, macOS, watchOS, tvOS, axiom-visionOS. iOS 13+ (Dark Mode), iOS 17+ (latest semantic colors), iOS 26+ (Liquid Glass)
metadata:
  version: "1.0.0"
---

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
- Use `axiom-hig-ref` for comprehensive details and code examples
- Use `axiom-liquid-glass` for iOS 26 material design implementation
- Use `axiom-liquid-glass-ref` for iOS 26 app-wide adoption guide
- Use `axiom-accessibility-diag` for accessibility troubleshooting

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
- tvOS: 60+ point spacing for focus clarity

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

## Resources

**WWDC**: 356, 2019-808

**Docs**: /design/human-interface-guidelines, /design/human-interface-guidelines/color, /design/human-interface-guidelines/dark-mode, /design/human-interface-guidelines/typography

**Skills**: axiom-hig-ref, axiom-liquid-glass, axiom-liquid-glass-ref, axiom-accessibility-diag

---

**Last Updated**: Based on Apple HIG (2024-2025), WWDC25-356, WWDC19-808
**Skill Type**: Discipline (Quick decisions, checklists, pressure scenarios)
