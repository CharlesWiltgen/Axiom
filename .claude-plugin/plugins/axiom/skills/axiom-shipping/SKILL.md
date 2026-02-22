---
name: axiom-shipping
description: Use when preparing ANY app for submission, handling App Store rejections, managing code signing, or setting up CI/CD. Covers App Store submission, rejection troubleshooting, metadata requirements, privacy manifests, age ratings, export compliance.
license: MIT
---

# Shipping & App Store Router

**You MUST use this skill when preparing to submit ANY app, handling App Store rejections, or working on release workflow.**

## When to Use

Use this router when you encounter:
- Preparing an app for App Store submission
- App Store rejection (any guideline)
- Metadata requirements (screenshots, descriptions, keywords)
- Privacy manifest and nutrition label questions
- Age rating and content classification
- Export compliance and encryption declarations
- EU DSA trader status
- Account deletion or Sign in with Apple requirements
- Build upload and processing issues
- App Review appeals
- WWDC25 App Store Connect changes
- First-time submission workflow

## Routing Logic

### 1. Pre-Submission Preparation → **app-store-submission**

**Triggers**:
- "How do I submit my app?"
- "What do I need before submitting?"
- Preparing for first submission
- Pre-flight checklist needed
- Screenshot requirements
- Metadata completeness check
- Encryption compliance questions
- Accessibility Nutrition Labels
- Privacy manifest requirements for submission

**Why app-store-submission**: Discipline skill with 8 anti-patterns, decision trees, and pressure scenarios. Prevents the mistakes that cause 90% of rejections.

**Invoke**: `/skill axiom-app-store-submission`

---

### 2. Metadata, Guidelines, and API Reference → **app-store-ref**

**Triggers**:
- "What fields are required in App Store Connect?"
- "What's the max length for app description?"
- Specific guideline number lookup
- Privacy manifest schema details
- Age rating tiers and questionnaire
- IAP submission metadata
- EU DSA compliance details
- Build upload methods
- WWDC25 changes to App Store Connect

**Why app-store-ref**: 10-part reference covering every metadata field, guideline, and compliance requirement with exact specifications.

**Invoke**: `/skill axiom-app-store-ref`

---

### 3. Rejection Troubleshooting → **app-store-diag**

**Triggers**:
- "My app was rejected"
- "Guideline 2.1 rejection"
- "Binary was rejected"
- How to respond to a rejection
- Writing an appeal
- Understanding rejection messages
- Third or repeated rejection
- Resolution Center communication

**Why app-store-diag**: 7 diagnostic patterns mapping rejection types to root causes and fixes. Includes appeal writing guidance and crisis scenario for repeated rejections.

**Invoke**: `/skill axiom-app-store-diag`

---

### 4. Privacy & Security Compliance → **security-privacy-scanner** (Agent)

**Triggers**:
- "Scan my code for privacy issues before submission"
- Hardcoded API keys or secrets
- Missing privacy manifest
- Required Reason API declarations
- ATS violations

**Why security-privacy-scanner**: Autonomous agent that scans for security vulnerabilities and privacy compliance issues that cause rejections.

**Invoke**: Launch `security-privacy-scanner` agent or `/axiom:audit security`

---

### 5. IAP Review Issues → **iap-auditor** (Agent)

**Triggers**:
- IAP rejected or not working
- Missing transaction.finish()
- Missing restore purchases
- Subscription tracking issues

**Why iap-auditor**: Scans IAP code for the patterns that cause StoreKit rejections.

**Invoke**: Launch `iap-auditor` agent

---

### 6. Programmatic ASC Access → **asc-mcp**

**Triggers**:
- "Automate App Store Connect"
- "Submit build programmatically"
- "Manage TestFlight from Claude"
- "Respond to reviews via API"
- "Set up asc-mcp"
- "Distribute to TestFlight groups via MCP"
- "Create a new version without opening ASC"

**Why asc-mcp**: Workflow-focused skill teaching Claude to use asc-mcp MCP tools for release pipelines, TestFlight distribution, review management, and feedback triage — all without leaving Claude Code.

**Invoke**: `/skill axiom-asc-mcp`

---

## Decision Tree

```dot
digraph shipping {
    "Shipping question?" [shape=diamond];
    "Rejected?" [shape=diamond];
    "Automate via MCP?" [shape=diamond];
    "Need specific specs?" [shape=diamond];
    "IAP issue?" [shape=diamond];
    "Want code scan?" [shape=diamond];

    "app-store-submission" [shape=box, label="app-store-submission\n(pre-flight checklist)"];
    "app-store-ref" [shape=box, label="app-store-ref\n(metadata/guideline specs)"];
    "app-store-diag" [shape=box, label="app-store-diag\n(rejection troubleshooting)"];
    "security-privacy-scanner" [shape=box, label="security-privacy-scanner\n(Agent)"];
    "iap-auditor" [shape=box, label="iap-auditor\n(Agent)"];
    "asc-mcp" [shape=box, label="asc-mcp\n(MCP tool workflows)"];

    "Shipping question?" -> "Rejected?" [label="yes, about to submit or general"];
    "Rejected?" -> "app-store-diag" [label="yes, app was rejected"];
    "Rejected?" -> "Automate via MCP?" [label="no"];
    "Automate via MCP?" -> "asc-mcp" [label="yes, programmatic ASC access"];
    "Automate via MCP?" -> "Need specific specs?" [label="no"];
    "Need specific specs?" -> "app-store-ref" [label="yes, looking up field/guideline"];
    "Need specific specs?" -> "IAP issue?" [label="no"];
    "IAP issue?" -> "iap-auditor" [label="yes"];
    "IAP issue?" -> "Want code scan?" [label="no"];
    "Want code scan?" -> "security-privacy-scanner" [label="yes, scan for privacy/security"];
    "Want code scan?" -> "app-store-submission" [label="no, general prep"];
}
```

Simplified:

1. App was rejected? → app-store-diag
2. Automate ASC via MCP tools? → asc-mcp
3. Need specific metadata/guideline specs? → app-store-ref
4. IAP submission issue? → iap-auditor (Agent)
5. Want pre-submission code scan? → security-privacy-scanner (Agent)
6. General submission preparation? → app-store-submission

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just submit and see what happens" | 40% of rejections are Guideline 2.1 (completeness). app-store-submission catches them in 10 min. |
| "I've submitted apps before, I know the process" | Requirements change yearly. Privacy manifests, age rating tiers, EU DSA, Accessibility Nutrition Labels are all new since 2024. |
| "The rejection is wrong, I'll just resubmit" | Resubmitting without changes wastes 24-48 hours per cycle. app-store-diag finds the root cause. |
| "Privacy manifests are only for big apps" | Every app using Required Reason APIs needs a manifest since May 2024. Missing = automatic rejection. |
| "I'll add the metadata later" | Missing metadata blocks submission entirely. app-store-ref has the complete field list. |
| "It's just a bug fix, I don't need a full checklist" | Bug fix updates still need What's New text, correct screenshots, and valid build. app-store-submission covers it. |
| "I'll just do it in the ASC web dashboard" | If asc-mcp is configured, MCP tools are faster for bulk operations — distributing builds, responding to reviews, creating versions. asc-mcp has the workflow. |

## When NOT to Use (Conflict Resolution)

**Do NOT use axiom-shipping for these — use the correct router instead:**

| Issue | Correct Router | Why NOT axiom-shipping |
|-------|---------------|----------------------|
| Build fails before archiving | **ios-build** | Environment/build issue, not submission |
| SwiftData migration crash | **ios-data** | Schema issue, not App Store |
| Privacy manifest coding (writing the file) | **ios-build** | security-privacy-scanner handles code scanning |
| StoreKit 2 implementation (writing IAP code) | **ios-integration** | in-app-purchases / storekit-ref covers implementation |
| Performance issues found during testing | **ios-performance** | Profiling issue, not submission |
| Accessibility implementation | **ios-accessibility** | Code-level accessibility, not App Store labels |

**axiom-shipping is for the submission workflow**, not code implementation:
- Preparing metadata and compliance → axiom-shipping
- Writing the actual code → domain-specific router (ios-build, ios-data, etc.)
- App was rejected → axiom-shipping
- Code changes to fix rejection → domain-specific router, then back to axiom-shipping to verify

## Example Invocations

User: "How do I submit my app to the App Store?"
→ Invoke: `/skill axiom-app-store-submission`

User: "My app was rejected for Guideline 2.1"
→ Invoke: `/skill axiom-app-store-diag`

User: "What screenshots do I need?"
→ Invoke: `/skill axiom-app-store-ref`

User: "What fields are required in App Store Connect?"
→ Invoke: `/skill axiom-app-store-ref`

User: "How do I fill out the age rating questionnaire?"
→ Invoke: `/skill axiom-app-store-ref`

User: "Do I need an encryption compliance declaration?"
→ Invoke: `/skill axiom-app-store-submission`

User: "My app keeps getting rejected, what do I do?"
→ Invoke: `/skill axiom-app-store-diag`

User: "How do I appeal an App Store rejection?"
→ Invoke: `/skill axiom-app-store-diag`

User: "Scan my code for App Store compliance issues"
→ Invoke: `security-privacy-scanner` agent

User: "Check my IAP implementation before submission"
→ Invoke: `iap-auditor` agent

User: "What's new in App Store Connect for 2025?"
→ Invoke: `/skill axiom-app-store-ref`

User: "I need to set up DSA trader status for the EU"
→ Invoke: `/skill axiom-app-store-ref`

User: "What are Accessibility Nutrition Labels?"
→ Invoke: `/skill axiom-app-store-submission`

User: "This is my first app submission ever"
→ Invoke: `/skill axiom-app-store-submission`

User: "Submit this build to App Store programmatically"
→ Invoke: `/skill axiom-asc-mcp`

User: "Set up asc-mcp for App Store Connect"
→ Invoke: `/skill axiom-asc-mcp`

User: "Distribute build 42 to my beta testers via MCP"
→ Invoke: `/skill axiom-asc-mcp`

User: "Respond to negative App Store reviews from Claude"
→ Invoke: `/skill axiom-asc-mcp`
