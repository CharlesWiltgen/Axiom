---
name: hig-ref
description: Reference — Comprehensive Apple Human Interface Guidelines covering colors (semantic, custom, patterns), backgrounds (material hierarchy, dynamic), typography (built-in styles, custom fonts, Dynamic Type), SF Symbols (rendering modes, color, localization), Dark Mode, accessibility, and platform-specific considerations
skill_type: reference
version: 1.0.0
apple_platforms: iOS, iPadOS, macOS, watchOS, tvOS, visionOS
---

# Apple Human Interface Guidelines — Comprehensive Reference

## Overview

The Human Interface Guidelines (HIG) define Apple's design philosophy and provide concrete guidance for creating intuitive, accessible, platform-appropriate experiences across all Apple devices.

### Three Core Principles

Every design decision should support these principles:

**1. Clarity**
Content is paramount. Interface elements should defer to content, not compete with it. Every element has a purpose, unnecessary complexity is eliminated, and users should immediately know what they can do without extensive instructions.

**2. Consistency**
Apps use standard UI elements and familiar patterns. Navigation follows platform conventions, gestures work as expected, and components appear in expected locations. This familiarity reduces cognitive load.

**3. Deference**
The UI should not distract from essential content. Use subtle backgrounds, receding navigation when not needed, restrained branding, and let content be the hero.

**From Apple HIG:** "Deference makes an app beautiful by ensuring the content stands out while the surrounding visual elements do not compete with it."

### Design System Philosophy

From WWDC25: "A systematic approach means designing with intention at every level, ensuring that all elements, from the tiniest control to the largest surface, are considered in relation to the whole."

#### Related Skills
- Use `hig` for quick decisions and checklists
- Use `liquid-glass` for iOS 26 material implementation
- Use `liquid-glass-ref` for iOS 26 app-wide adoption
- Use `accessibility-diag` for accessibility troubleshooting

---

## Color System

### Semantic Colors Explained

Instead of hardcoded color values, use **semantic colors** that describe the *purpose* of a color rather than its appearance. Semantic colors automatically adapt to light/dark mode and accessibility settings.

**Key insight from WWDC19:** "Think of Dark Mode as having the lights dimmed rather than everything being flipped inside out." Colors are NOT simply inverted—table row backgrounds are lighter in both modes.

### Label Colors (Foreground Content)

Use label colors for text and symbols:

```swift
// Primary content (most prominent)
Text("Title")
    .foregroundStyle(.primary)
// Uses `label` color - black in Light Mode, white in Dark Mode

// Secondary content (subtitles, less prominent)
Text("Subtitle")
    .foregroundStyle(.secondary)
// Uses `secondaryLabel` - gray tone

// Tertiary content (placeholder text)
Text("Placeholder")
    .foregroundStyle(.tertiary)
// Uses `tertiaryLabel` - lighter gray

// Quaternary content (disabled text)
Text("Disabled")
    .foregroundStyle(.quaternary)
// Uses `quaternaryLabel` - very light gray
```

**Hierarchy:** `label` → `secondaryLabel` → `tertiaryLabel` → `quaternaryLabel`

### Background Colors (Primary → Tertiary)

Background colors come in two sets: **ungrouped** and **grouped**.

#### Ungrouped Backgrounds

For standard lists and views:

```swift
// Primary background (main background)
Color(.systemBackground)
// Pure white in Light Mode, pure black in Dark Mode

// Secondary background (information structure)
Color(.secondarySystemBackground)
// Light gray in Light Mode, dark gray in Dark Mode

// Tertiary background (further layering)
Color(.tertiarySystemBackground)
// Lighter than secondary, darker in Dark Mode
```

#### Grouped Backgrounds

For grouped table views (iOS Settings style):

```swift
// Primary grouped background
Color(.systemGroupedBackground)

// Secondary grouped background
Color(.secondarySystemGroupedBackground)

// Tertiary grouped background
Color(.tertiarySystemGroupedBackground)
```

**Usage:**
```swift
// Standard list
List {
    Text("Item")
}
.background(Color(.systemBackground))

// Grouped list (Settings style)
List {
    Section("Section 1") {
        Text("Item")
    }
}
.listStyle(.grouped)
```

### Base vs Elevated Backgrounds

There are actually **two sets** of background colors for layering interfaces:

- **Base set:** Used for background apps/interfaces
- **Elevated set:** Used for foreground apps/interfaces

**Why this matters:**

In Light Mode, simple drop shadows create visual separation. In Dark Mode, drop shadows are less effective, so the system uses **lighter colors for elevated content**.

**Example:** iPad multitasking:
- Mail app alone → base color set
- Contacts in slide-over → elevated colors (lighter, stands out)
- Both side-by-side → both use elevated colors for contrast around splitter
- Email compose sheet → elevated colors with overlay dimming

**Critical:** Some darker colors may not contrast well when elevated. Always test designs in elevated state. Semi-opaque fill and separator colors adapt gracefully.

### Tint Colors (Dynamic Adaptation)

Tint colors are **dynamic** - they have variants for Light and Dark modes:

```swift
// Tint color automatically adapts
Button("Primary Action") {
    // action
}
.tint(.blue)
// Gets lighter in Dark Mode, darker in Light Mode
```

**Custom tint colors:**
When creating custom tint colors, select colors that work well in both modes. Use a contrast calculator to aim for **4.5:1 or higher** contrast ratio. Colors that work in Light Mode may have insufficient contrast in Dark Mode.

### Fill Colors (Semi-Transparent)

Fill colors are **semi-transparent** to contrast well against variable backgrounds:

```swift
// System fill colors
Color(.systemFill)
Color(.secondarySystemFill)
Color(.tertiarySystemFill)
Color(.quaternarySystemFill)
```

**When to use:** Controls, buttons, and interactive elements that need to appear above dynamic backgrounds.

### Separator Colors

```swift
// Standard separator (semi-transparent)
Color(.separator)

// Opaque separator
Color(.opaqueSeparator)
```

**Opaque separators** are used when transparency would create undesirable results (e.g., intersecting grid lines where overlapping semi-transparent colors create optical illusions).

### When to Use Permanent Dark Backgrounds

**Apple's explicit guidance:**
> "In rare cases, consider using only a dark appearance in the interface. For example, it can make sense for an app that enables **immersive media viewing** to use a permanently dark appearance that lets the UI recede and helps people focus on the media."

**Examples from Apple's apps:**

| App | Background | Rationale |
|-----|------------|-----------|
| Music | Dark | Album art should be visual focus |
| Photos | Dark | Images are hero content |
| Clock | Dark | Nighttime use, instrument feel |
| Stocks | Dark | Data visualization, charts |
| Camera | Dark | Reduces distraction during capture |

**For all other apps:** Support both Light and Dark modes via system backgrounds.

### Creating Custom Colors

When you need custom colors:

1. **Open Assets.xcassets**
2. **Add Color Set**
3. **Configure variants:**
   - Light mode color
   - Dark mode color
   - High Contrast Light (optional but recommended)
   - High Contrast Dark (optional but recommended)

```swift
// Use custom color from asset catalog
Color("BrandAccent")
// Automatically uses correct variant
```

---

## Typography

### System Fonts

**San Francisco (SF):** The system sans-serif font family.
- SF Pro: General use
- SF Compact: watchOS and space-constrained layouts
- SF Mono: Code and monospaced text
- SF Rounded: Softer, friendlier feel
- Weights: Ultralight, Thin, Light, Regular, Medium, Semibold, Bold, Heavy, Black

**New York (NY):** System serif font family for editorial content.

**Both available as variable fonts** with seamless weight transitions.

### Font Weight Recommendations

**From Apple HIG:** "Avoid light font weights. Prefer Regular, Medium, Semibold, or Bold weights instead of Ultralight, Thin, or Light."

**Why:** Light weights have legibility issues, especially at small sizes, in bright lighting, or for users with visual impairments.

**Hierarchy:**
```swift
// Headers - Bold weight for prominence
Text("Header")
    .font(.title.weight(.bold))

// Subheaders - Semibold
Text("Subheader")
    .font(.title2.weight(.semibold))

// Body - Regular or Medium
Text("Body text")
    .font(.body)

// Captions - Regular (never Light)
Text("Caption")
    .font(.caption)
```

### Text Styles for Hierarchy

Use built-in text styles for automatic hierarchy and Dynamic Type support:

```swift
.font(.largeTitle)    // Largest
.font(.title)         // Page titles
.font(.title2)        // Section headers
.font(.title3)        // Sub-section headers
.font(.headline)      // Emphasized body
.font(.body)          // Default body text
.font(.callout)       // Slightly emphasized
.font(.subheadline)   // Less prominent
.font(.footnote)      // Auxiliary info
.font(.caption)       // Minimal emphasis
.font(.caption2)      // Smallest
```

### Dynamic Type Support

**Requirement:** Apps must support text scaling of at least **200%** (iOS, iPadOS) or **140%** (watchOS).

**Implementation:**
```swift
// ✅ CORRECT - Scales automatically
Text("Hello")
    .font(.body)

// ❌ WRONG - Fixed size, doesn't scale
Text("Hello")
    .font(.system(size: 17))
```

**Layout considerations:**
- Reduce multicolumn layouts at larger sizes
- Minimize text truncation
- Use stacked layouts instead of inline at large sizes
- Maintain consistent information hierarchy regardless of size

**Not all content scales equally:** Prioritize what users actually care about. Secondary elements like tab titles shouldn't grow as much as primary content.

### Custom Fonts

When using custom fonts:
- Ensure legibility at various distances and conditions
- Implement Dynamic Type support
- Respond to Bold Text accessibility setting
- Test at all text sizes
- Match system font behaviors for accessibility

**If your custom font is thin:** Increase size by ~2 points when pairing with uppercase Latin text.

### Leading (Line Spacing)

**Loose leading:** Wide columns (easier to track to next line)
**Tight leading:** Constrained height (avoid for 3+ lines)

```swift
// Adjust leading for specific layouts
Text("Long content...")
    .lineSpacing(8) // Add space between lines
```

---

## Shapes & Geometry

### Three Shape Types (iOS 26)

From WWDC25: "There's a quiet geometry to how our shapes fit together, driven by **concentricity**. By aligning radii and margins around a shared center, shapes can comfortably nest within each other."

#### 1. Fixed Shapes

Constant corner radius regardless of size:

```swift
RoundedRectangle(cornerRadius: 12)
```

**Use when:** You need a specific, unchanging corner radius.

#### 2. Capsules

Radius is half the container's height:

```swift
Capsule()
```

**Use when:** You want shapes that adapt to content while maintaining rounded ends. Perfect for buttons, pills, and controls.

**Found throughout iOS 26:** Sliders, switches, grouped table views, tab bars, navigation bars.

#### 3. Concentric Shapes

Calculate radius by subtracting padding from parent's radius:

```swift
.containerRelativeShape(.roundedRectangle)
```

**Use when:** Nesting shapes within containers to maintain visual harmony.

### Concentricity Principle

**Hardware ↔ Software harmony:** Apple's hardware features consistent bezel curvature. The same precision now guides UI, with curvature, size, and proportion aligning to create unified rhythm between what you hold and what you see.

**Example of concentricity:**
```
Window (rounded corners)
  ├─ Sheet (concentric to window)
  │   ├─ Card (concentric to sheet)
  │   │   └─ Button (concentric to card)
```

### Platform-Specific Guidance

**iOS:**
- **Capsules** for buttons, switches, grouped lists
- Creates hierarchy and focus in touch-friendly layouts

**macOS:**
- **Mini, Small, Medium controls** → Rounded rectangles (dense layouts, inspector panels)
- **Large, X-Large controls** → Capsules (spacious areas, emphasis via Liquid Glass)

### Optical Centering

To preserve optical balance, views are:
- Mathematically centered when it makes sense
- Subtly offset when optical weight requires it

**Example:** Asymmetric icons may need padding adjustments for optical centering rather than geometric centering.

---

## Materials & Depth

### Standard Materials

Materials allow background content to show through, creating visual depth and hierarchy.

#### Four Thickness Options

1. **Ultra-thin** — Minimal separation, content clearly visible
2. **Thin** — Lighter-weight interactions
3. **Regular** — Default, works well in most circumstances
4. **Thick** — Most separation from background

**Choosing thickness:**
- Content needs more contrast → thicker material
- Simpler content → thin/ultra-thin material

```swift
// Apply material
.background(.ultraThinMaterial)
.background(.thinMaterial)
.background(.regularMaterial)
.background(.thickMaterial)
```

### Vibrancy with Materials

**Key principle:** Use vibrant colors on top of materials for legibility. Solid colors can get muddy depending on background context. Vibrancy maintains contrast regardless of background.

```swift
// Vibrant text on material
VStack {
    Text("Primary")
        .foregroundStyle(.primary) // Vibrant
    Text("Secondary")
        .foregroundStyle(.secondary) // Vibrant
}
.background(.regularMaterial)
```

### Liquid Glass (iOS 26+)

**Purpose:** Creates a distinct functional layer for controls and navigation, floating above content.

**Two variants:**

1. **Regular Liquid Glass**
   - Default, use in 95% of cases
   - Full visual and adaptive effects
   - Provides legibility regardless of context
   - Works over any background

2. **Clear Liquid Glass**
   - Highly translucent
   - No adaptive behaviors
   - **Only use for components over visually rich backgrounds** (photos, videos)
   - Requires dimming layer for legibility

**Cross-reference:** See `liquid-glass` skill for implementation details and `liquid-glass-ref` for comprehensive adoption guide.

---

## Layout Principles

### Visual Hierarchy

**Place items to convey their relative importance:**
- Important content → top and leading side
- Secondary content → below or trailing
- Tertiary content → separate views or progressive disclosure

**From Apple HIG:** "Make essential information easy to find by giving it sufficient space and avoid obscuring it with nonessential details."

### Grouping & Organization

Group related items using:
- Negative space (whitespace)
- Colors and materials
- Separator lines

**Ensure content and controls remain clearly distinct** through Liquid Glass material and scroll edge effects.

### Content Extension to Edges

"Extend content to fill the screen or window" with backgrounds and artwork reaching display edges.

**Background extension views:** Use when content doesn't naturally span the full window.

```swift
// Content extends to edges
VStack {
    FullWidthImage()
        .ignoresSafeArea() // Extends to screen edges
}
```

### Safe Areas & Layout Guides

**Safe Areas:** Rectangular regions unobstructed by:
- Status bar
- Navigation bar
- Tab bar
- Toolbar
- Device features (Dynamic Island, notch, home indicator)

**Layout Guides:** Define rectangular regions for positioning and spacing content with:
- Predefined margins
- Text width optimization
- Reading width constraints

**Key principle:** "Respect key display and system features in each platform."

```swift
// Respect safe areas
VStack {
    Text("Content")
}
.safeAreaInset(edge: .bottom) {
    BottomBar()
}
```

### Align Components

"Align components with one another to make them easier to scan."

**Grid alignment:**
- Text baselines align
- Controls align on common grid
- Spacing is consistent and rhythmic

### Adaptability Requirements

Design layouts that:
- "Adapt gracefully to context changes while remaining recognizably consistent"
- Support Dynamic Type text-size changes
- Work across multiple devices, orientations, and localizations
- Account for different screen sizes, resolutions, and system features

---

## Accessibility

### Vision Accessibility

#### Text & Legibility

**Requirements:**
- Support text enlargement of at least **200%** (140% for watchOS)
- Implement Dynamic Type for systemwide text adjustment
- Use font weights that enhance readability (avoid Light weights with custom fonts)

#### Color Contrast

**WCAG Level AA standards:**
- Normal text (14pt+): **4.5:1 minimum**
- Small text (<14pt): **7:1 recommended**
- Large text (18pt+ regular, 14pt+ bold): 3:1 acceptable

**Implementation:**
```swift
// ✅ Use semantic colors (automatic contrast)
Text("Label").foregroundStyle(.primary)

// ❌ Custom colors may fail contrast
Text("Label").foregroundStyle(.gray) // Check with calculator
```

**High contrast mode:**
Provide higher contrast color schemes when "Increase Contrast" accessibility setting is enabled.

**Test in both Light and Dark modes.**

#### Color Considerations

**Critical:** "Convey information with more than color alone" to support colorblind users.

**Solutions:**
- Use distinct shapes or icons alongside color
- Add text labels
- Employ system-defined colors with accessible variants
- Test with Color Blindness simulators

**Example:**
```swift
// ❌ Only color indicates status
Circle().fill(isActive ? .green : .red)

// ✅ Shape + color
HStack {
    Image(systemName: isActive ? "checkmark.circle.fill" : "xmark.circle.fill")
    Text(isActive ? "Active" : "Inactive")
}
.foregroundStyle(isActive ? .green : .red)
```

#### Screen Readers

Describe interface and content for VoiceOver accessibility:

```swift
Button {
    share()
} label: {
    Image(systemName: "square.and.arrow.up")
}
.accessibilityLabel("Share")
```

### Hearing Accessibility

#### Media Alternatives

For video/audio content, provide:
- Captions for dialogue
- Subtitles
- Audio descriptions for visual-only information
- Transcripts for longer-form media

#### Audio Cues

Pair audio signals with:
- Haptic feedback
- Visual indicators

### Mobility Accessibility

**Touch targets:**
- Minimum: **44x44 points**
- Spacing: 12-24 points padding around controls

**Gestures:**
- Use simple gestures
- Offer alternatives (buttons alongside gestures)
- Support Voice Control
- Enable keyboard navigation

**Assistive technologies:**
- VoiceOver
- Switch Control
- Full Keyboard Access

### Cognitive Accessibility

#### Interaction Design

- "Keep actions simple and intuitive"
- Avoid time-based auto-dismissing views
- Prevent autoplay of audio/video without controls

#### Motion & Visual Effects

**Respect "Reduce Motion":**
- Minimize animations
- Avoid excessive flashing lights
- Support "Dim Flashing Lights"
- Reduce bounce effects
- Minimize z-axis depth changes

```swift
// Check Reduce Motion setting
@Environment(\.accessibilityReduceMotion) var reduceMotion

var body: some View {
    content
        .animation(reduceMotion ? nil : .spring(), value: isExpanded)
}
```

#### Game Accommodations

Offer adjustable difficulty levels.

### visionOS Specific

Prioritize comfort:
- Maintain horizontal layouts
- Reduce animation speed
- Avoid head-anchored content (prevents assistive technology use)

---

## Motion & Animation

### Core Principles

**Purposeful Animation:** "Add motion purposefully, supporting the experience without overshadowing it."

**Avoid gratuitous animations** that distract or cause discomfort. Motion should enhance rather than dominate the interface.

### Accessibility First

**Make motion optional.** Supplement visual feedback with **haptics** and **audio** to communicate important information, ensuring all users can understand your interface regardless of motion preferences.

### Best Practices for Feedback

#### Realistic Motion

Design animations aligned with user expectations and gestures. Feedback should be:
- "Brief and precise"
- Lightweight
- Effectively conveying information without distraction

#### Frequency Considerations

**Avoid animating frequent UI interactions.** Standard system elements already include subtle animations, so custom elements shouldn't add unnecessary motion to common actions.

#### User Control

"Let people cancel motion" by not forcing them to wait for animations to complete before proceeding, especially for repeated interactions.

```swift
// ✅ Allow immediate tap, don't block on animation
Button("Next") {
    withAnimation(.easeOut(duration: 0.2)) {
        showNext = true
    }
}
// User can tap again immediately, not forced to wait
```

### Platform-Specific Guidance

#### visionOS

- **Avoid motion at peripheral vision edges** — causes discomfort
- Use fades when relocating objects rather than visible movement
- Maintain stationary frames of reference
- Avoid sustained oscillations (especially at 0.2 Hz frequency)
- Prevent virtual world rotation (disrupts stability)

#### watchOS

SwiftUI provides animation capabilities; WatchKit offers `WKInterfaceImage` for layout animations and sequences.

---

## Icons & Symbols

### SF Symbols

**Advantages:**
- **5,000+ symbols** included with system (SF Symbols 5)
- Match San Francisco font visual characteristics
- Can be typed inline with text
- Embedded baseline values for proper vertical alignment
- Small, medium, and large-scale variants
- Nine weights matching SF font
- Vector-based — scale with text and Dynamic Type
- Become bolder when Bold Text accessibility enabled
- Automatic light/dark adaptation

**Usage:**
```swift
Label("Settings", systemImage: "gear")

Image(systemName: "star.fill")
    .font(.title) // Scales with text size
```

### Custom Interface Icons

**Key design principles:**

**Simplification & Recognition:** Create "recognizable, highly simplified design[s]" to avoid confusion. Icons work best with familiar visual metaphors directly connected to their actions or content.

**Visual Consistency:** Maintain uniform:
- Size
- Detail level
- Stroke thickness
- Perspective across all interface icons

**Weight Matching:** Align interface icon weights with adjacent text for consistent emphasis unless deliberately emphasizing one element.

**Optical Alignment:** Asymmetric icons may need padding adjustments for optical centering rather than geometric centering, particularly when visual weight concentrates on one area.

### Format & Implementation

**Vector formats required:** Use **PDF or SVG** for custom interface icons to enable automatic scaling across display resolutions. PNG requires multiple versions for each icon.

**Selected states:** System components (toolbars, tab bars, buttons) automatically handle selected appearances—custom versions aren't necessary.

### When to Use Icons vs Text

From WWDC25: "A pencil might suggest annotate, and a checkmark can look like confirm—making actions like Select or Edit easy to misread. **When there's no clear shorthand, a text label is always the better choice.**"

**Use icons when:**
- Symbol has clear, universal meaning (share, trash, settings)
- Space is constrained
- Icon aids quick scanning

**Use text when:**
- Action has no clear symbol
- Multiple similar actions exist
- Clarity is more important than space

### Accessibility

**Always provide alternative text labels** enabling VoiceOver descriptions:

```swift
Image(systemName: "star.fill")
    .accessibilityLabel("Favorite")
```

---

## Gestures & Input

### Core Gesture Design Principles

**Consistency and Familiarity:** "People expect most gestures to work the same regardless of their current context." Standard gestures like tap, swipe, and drag should perform their expected functions across platforms.

**Responsive Feedback:** "Handle gestures as responsively as possible" and provide immediate feedback during gesture performance so users can predict outcomes.

### Standard Gestures

Basic gestures supported across all platforms (though precise movements vary by device):
- Tap
- Swipe
- Drag
- Pinch
- Rotate (iOS/iPadOS)
- Long press

### Touch Target Requirements

**Minimum touch target sizes:**

| Platform | Minimum Size | Spacing |
|----------|-------------|---------|
| iOS/iPadOS | 44x44 points | 12-24pt padding |
| macOS | Varies by control | System spacing |
| watchOS | System controls | Optimized for small screen |
| tvOS | Large (focus model) | 60pt+ spacing |

```swift
// ✅ Adequate touch target
Button("Tap") { }
    .frame(minWidth: 44, minHeight: 44)

// ❌ Too small
Button("Tap") { }
    .frame(width: 20, height: 20) // Fails accessibility
```

### Custom Gesture Guidelines

Custom gestures should only be implemented when necessary and must be:
- **Discoverable** — Users can find them
- **Straightforward to perform** — Easy to execute
- **Distinct from other gestures** — No conflicts
- **Never the only method** — Provide alternatives for important actions

**Warning:** Don't replace standard gestures with custom ones. Shortcuts should supplement, not replace, familiar interactions.

### Accessibility

**Critical:** "Give people more than one way to interact with your app." Never assume users can perform specific gestures.

**Provide alternatives:**
- Voice control
- Keyboard navigation
- Button alternatives to gestures

```swift
// ✅ Swipe action + button alternative
.swipeActions {
    Button("Delete", role: .destructive) {
        delete()
    }
}
.contextMenu {
    Button("Delete", role: .destructive) {
        delete()
    }
}
```

---

## Launch & Onboarding

### Launch Screens

**Mandatory for:** iOS, iPadOS, tvOS
**Not required for:** macOS, visionOS, watchOS

**Design principle:** "Design a launch screen that's nearly identical to the first screen of your app or game" to avoid jarring visual transitions.

#### Best Practices

**Minimize branding:**
- Avoid logos
- No splash screens
- No artistic flourishes
- Purpose: Enhance perception of quick startup, not showcase brand

**No text:**
- Launch screen content cannot be localized
- Avoid text entirely

**Match appearance:**
- Respect device orientation
- Adapt to light/dark mode

```swift
// Launch screen matches first screen
// Transitions smoothly without flash
```

### Onboarding

Onboarding is a **separate experience** that follows the launch phase. Provides "a high-level view of your app or game" and can include a splash screen if needed.

**When to use:** Only when you have meaningful context to communicate to new users.

**What onboarding can include:**
- Branding and splash screens
- Educational content
- Permission requests
- Account setup

**Timeline:**
1. Launch — System displays launch screen, transitions to first screen
2. Onboarding (optional) — Can include branding and education
3. Continued use — "Restore the previous state when your app restarts so people can continue where they left off"

---

## Platform-Specific Guidance

### iOS

**Device characteristics:**
- Medium-size, high-resolution display
- One or two-handed interaction
- Portrait/landscape switching
- Viewing distance: 1-2 feet

**Input methods:**
- Multi-Touch gestures
- Virtual keyboards
- Voice control
- Gyroscope/accelerometer
- Spatial interactions

**Design patterns:**
- Swiping for back navigation
- List actions positioned in middle or bottom areas
- Multiple simultaneous apps
- Frequent app switching

**Content hierarchy:**
- "Limit the number of onscreen controls while making secondary details and actions discoverable with minimal interaction"

**System integration:**
- Widgets
- Home Screen quick actions
- Spotlight search
- Shortcuts
- Activity views

### iPadOS

**Extends iOS with:**
- Larger display (more content simultaneously)
- Sidebar-adaptable layouts
- Split view multitasking
- Pointer/trackpad support
- Arbitrary window sizing (iOS 26+)
- Menu bar (swiping down from top)

**Design considerations:**
- Don't just scale iOS layouts
- Leverage sidebars for navigation
- Support split view
- Optimize for pointer interactions

### macOS

**Characteristics:**
- Large, high-resolution display
- Pointer-first interactions
- Keyboard-centric workflows
- Multiple windows
- Menu bar for commands

**Design patterns:**
- Dense layouts acceptable
- Smaller controls (vs iOS)
- Window chrome and controls
- Contextual menus expected
- Keyboard shortcuts essential

**Control sizes:**
- Mini, Small, Medium → Rounded rectangles
- Large, X-Large → Capsules (iOS 26+)

### watchOS

**Constraints:**
- Very small display
- Glanceable interfaces
- Minimal interaction time
- Always-on consideration

**Design principles:**
- Full-bleed content
- Minimal padding
- Digital Crown interactions
- Complications for watch faces

### tvOS

**Characteristics:**
- Large display
- 10-foot viewing distance
- Focus-based navigation
- Gestural remote

**Design requirements:**
- Large touch targets
- Focus states clear and prominent
- Limited text input
- Spatial navigation (up/down/left/right)

### visionOS

**Unique aspects:**
- Spatial computing
- Glass materials
- 3D layouts
- Depth and layering

**Design principles:**
- Comfortable viewing depth
- Avoid head-anchored content
- Center important content in field of view
- Use depth deliberately for large, important elements

---

## Inclusive Design

### Language & Communication

**Welcoming language requirements:**
- Use plain, direct, and respectful tone
- Don't suggest exclusivity based on education level
- Address people directly with "you/your" rather than "the user"
- Define specialized or technical terms when necessary
- Replace culture-specific expressions with plain alternatives

**Avoid phrases with oppressive origins** (e.g., "peanut gallery").

**Exercise caution with humor** — it's subjective and difficult to translate across cultures.

### Visual Representation

**Portraying human diversity:**
- Feature people demonstrating range of racial backgrounds, body types, ages, physical capabilities
- Avoid stereotypical representations in occupations and behaviors

**Avoiding assumptions:**
- Don't assume narrow definitions of family structures
- Don't assume universal experiences
- Replace culture-specific security questions with more universal experiences

### Gender Identity & Pronouns

**Best practices:**
- Avoid unnecessary gender references in copy
- Provide inclusive options: "nonbinary," "self-identify," "decline to state"
- Use nongendered imagery
- Allow customization of avatars and characters

### Accessibility & Disability

**Recognize:**
- Disabilities exist on spectrums
- Temporary/situational disabilities affect everyone

**Include:**
- People with disabilities in diversity representations
- Adopt people-first approach in writing ("person with disability" vs "disabled person")

### Localization & Global Considerations

**Prepare software for:**
- Internationalization
- Translation into multiple languages

**Cultural color awareness:**
- Colors carry culture-specific meanings
- White represents death in some cultures, purity in others
- Red signifies danger in some cultures, positive meanings elsewhere

**Use plain language** and avoid stereotypes to facilitate smoother localization.

---

## Branding

### Core Principles

**Voice & Tone:** Maintain consistent brand personality through written communication.

**Visual Elements:**
- Consider accent color for UI components
- Custom font if strongly associated with brand (but system fonts work better for body copy due to legibility)

### Key Restraint Guidelines

**Most critical guidance — restraint:**

**Defer to content:** "Using screen space for an element that does nothing but display a brand asset can mean there's less room for the content people care about."

**Logo minimalism:** "Resist the temptation to display your logo throughout your app or game unless it's essential for providing context."

**Familiar patterns:** Maintain standard UI behaviors and component placement even with stylized designs to keep interfaces approachable.

**Launch screen caution:** Avoid using launch screens for branding since they disappear too quickly; consider onboarding screens instead for brand integration.

### Appropriate Branding

**Do:**
- Use your brand's accent color as app tint color
- Include branding in onboarding (not launch screen)
- Use brand voice in copy
- Feature brand in content, not chrome

**Don't:**
- Display logo in navigation bar
- Override system backgrounds with brand colors
- Add splash screens
- Make branding compete with content

### Legal Consideration

Apple trademarks cannot appear in your app name or images—consult Apple's official trademark guidelines.

---

## Troubleshooting Common HIG Issues

### Color Contrast Failures

**Symptom:** App Store rejection for accessibility violations, or colors don't meet WCAG standards.

**Diagnosis:**
1. Test with Xcode Accessibility Inspector
2. Use online contrast calculators
3. Check in both Light and Dark modes
4. Test with Increase Contrast enabled

**Solution:**
```swift
// ❌ PROBLEM: Custom gray fails contrast
Text("Label").foregroundStyle(.gray) // May fail 4.5:1 requirement

// ✅ SOLUTION 1: Use semantic colors (automatic compliance)
Text("Label").foregroundStyle(.secondary)

// ✅ SOLUTION 2: Use darker custom color with verified contrast
Text("Label").foregroundStyle(Color(red: 0.25, green: 0.25, blue: 0.25))
// This achieves ~8:1 contrast on white background (WCAG AAA)
```

### Touch Targets Too Small

**Symptom:** Users report difficult tapping, App Store accessibility rejection.

**Diagnosis:**
```swift
// Check button size
Button("Tap") { }
    .frame(width: 30, height: 30) // ❌ Too small
```

**Solution:**
```swift
// ✅ Expand touch target to minimum 44x44
Button("Tap") { }
    .frame(minWidth: 44, minHeight: 44)

// ✅ Alternative: Add padding
Button("Tap") { }
    .padding() // System adds appropriate padding
```

### Dark Mode Issues

**Symptom:** Colors look wrong in Dark Mode, insufficient contrast.

**Diagnosis:**
- Hardcoded colors that don't adapt
- Custom colors without dark variants
- Not testing in both appearance modes

**Solution:**
```swift
// ❌ PROBLEM: Hardcoded white text
Text("Label").foregroundStyle(.white)
// Invisible in Light Mode

// ✅ SOLUTION: Semantic color
Text("Label").foregroundStyle(.primary)
// Black in Light, white in Dark

// ✅ ALTERNATIVE: Asset catalog color with variants
Text("Label").foregroundStyle(Color("BrandText"))
// Define in Assets.xcassets with Light/Dark variants
```

### Light Font Weight Legibility

**Symptom:** Text hard to read, especially at small sizes or in bright lighting.

**Diagnosis:**
```swift
Text("Headline")
    .font(.system(size: 17, weight: .ultralight)) // ❌ Too light
```

**Solution:**
```swift
// ✅ Use Regular minimum
Text("Headline")
    .font(.system(size: 17, weight: .regular))

// ✅ Better: Use system text styles
Text("Headline")
    .font(.headline) // Automatically uses appropriate weight
```

### Dynamic Type Not Working

**Symptom:** Text doesn't scale when user increases text size in Settings.

**Diagnosis:**
```swift
// ❌ Fixed size doesn't scale
Text("Label").font(.system(size: 17))
```

**Solution:**
```swift
// ✅ Use text styles for automatic scaling
Text("Label").font(.body)

// ✅ Custom font with scaling
Text("Label").font(.custom("CustomFont", size: 17, relativeTo: .body))
```

### Reduce Motion Not Respected

**Symptom:** Users with motion sensitivity experience discomfort.

**Diagnosis:**
- Animations always play regardless of setting
- No alternative for motion-sensitive users

**Solution:**
```swift
// ✅ Check Reduce Motion setting
@Environment(\.accessibilityReduceMotion) var reduceMotion

var body: some View {
    content
        .animation(reduceMotion ? nil : .spring(), value: isExpanded)
}

// ✅ Alternative: Simpler animation
.animation(reduceMotion ? .linear(duration: 0.1) : .spring(), value: isExpanded)
```

### VoiceOver Labels Missing

**Symptom:** VoiceOver announces unhelpful information like "Button" instead of action.

**Diagnosis:**
```swift
// ❌ Image button without label
Button {
    share()
} label: {
    Image(systemName: "square.and.arrow.up")
}
// VoiceOver says: "Button"
```

**Solution:**
```swift
// ✅ Add accessibility label
Button {
    share()
} label: {
    Image(systemName: "square.and.arrow.up")
}
.accessibilityLabel("Share")
// VoiceOver says: "Share, Button"
```

### Information Only Conveyed by Color

**Symptom:** Colorblind users can't distinguish status.

**Diagnosis:**
```swift
// ❌ Only color indicates state
Circle()
    .fill(isComplete ? .green : .red)
```

**Solution:**
```swift
// ✅ Use shape + color + text
HStack {
    Image(systemName: isComplete ? "checkmark.circle.fill" : "xmark.circle.fill")
    Text(isComplete ? "Complete" : "Incomplete")
}
.foregroundStyle(isComplete ? .green : .red)
```

### Launch Screen Branding Rejection

**Symptom:** App Store rejects launch screen with logo or text.

**Diagnosis:**
- Launch screen contains branding elements
- Launch screen has text that can't be localized

**Solution:**
```swift
// ❌ Launch screen with logo (rejected)
// Launch.storyboard contains app logo

// ✅ Launch screen matches first screen (approved)
// Launch.storyboard shows same background/layout as first screen
// No text, no logos, minimal branding

// Move branding to onboarding screen instead
```

### Custom Appearance Toggle Issues

**Symptom:** Users confused by app-specific dark mode setting, double settings.

**Diagnosis:**
- App has its own Light/Dark toggle
- Conflicts with system Settings → Display & Brightness

**Solution:**
```swift
// ❌ App-specific appearance toggle
.preferredColorScheme(userPreference == .dark ? .dark : .light)

// ✅ Respect system preference
// Remove custom toggle, use system preference
// Let iOS Settings control appearance
```

---

## Resources

**WWDC**: 356, 2019-808

**Docs**: /design/human-interface-guidelines, /design/human-interface-guidelines/color, /design/human-interface-guidelines/dark-mode, /design/human-interface-guidelines/materials, /design/human-interface-guidelines/typography, /design/human-interface-guidelines/layout, /design/human-interface-guidelines/accessibility, /design/human-interface-guidelines/icons

**Skills**: hig, liquid-glass, liquid-glass-ref, swiftui-layout-ref, accessibility-diag

---

**Last Updated**: Based on Apple HIG (2024-2025), WWDC25-356, WWDC19-808
**Skill Type**: Reference (Comprehensive guide with code examples)
