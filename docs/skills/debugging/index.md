# Debugging & Troubleshooting

Systematic debugging strategies to solve issues faster and prevent common problems before they happen.

## Skills

- **[Accessibility Debugging](/skills/debugging/accessibility-debugging)** – WCAG compliance, VoiceOver testing, Dynamic Type support, App Store Review preparation
  - *"App Store rejected my app for VoiceOver issues. How do I fix missing labels?"*
  - *"How do I test my app for color contrast and Dynamic Type support?"*
  - **Command** [`/audit-accessibility`](/commands/accessibility/audit-accessibility) for quick WCAG compliance scanning

- **[Xcode Debugging](/skills/debugging/xcode-debugging)** – Environment-first diagnostics for mysterious Xcode issues, prevents 30+ minute rabbit holes
  - *"My build is failing with 'BUILD FAILED' but no error details. I haven't changed anything."*
  - *"Build succeeds but old code is executing. I restarted Xcode but it still happens."*

- **[Memory Debugging](/skills/debugging/memory-debugging)** – Systematic leak diagnosis with 5 patterns covering 90% of real-world issues
  - *"My app crashes after 10-15 minutes of use with no error messages. How do I find the leak?"*
  - *"View controllers don't deallocate after dismiss. How do I find the retain cycle?"*
  - **Command** [`/audit-memory`](/commands/debugging/audit-memory) for quick triage scanning

- **[Build Troubleshooting](/skills/debugging/build-troubleshooting)** – Dependency resolution for CocoaPods and Swift Package Manager conflicts
  - *"I added a Swift Package but I'm getting 'No such module' errors."*
  - *"Build works on my Mac but fails on CI. Both have the latest Xcode."*

- **[Performance Profiling](/skills/debugging/performance-profiling)** – Instruments decision trees for CPU, memory, battery profiling with 3 real-world examples
  - *"Scrolling is slow and I need to know if it's Core Data or SwiftUI."*
  - *"We have a deadline and my app feels slow. What should I optimize first?"*

- **[Deep Link Debugging](/skills/debugging/deep-link-debugging)** – Add debug-only deep links for automated testing and closed-loop debugging (60-75% faster iteration)
  - *"Claude Code can't navigate to specific screens for testing. How do I add debug deep links?"*
  - *"I want to take screenshots of different screens automatically."*
  - **Related** [`simulator-tester` agent](/agents/simulator-tester) for automated testing with deep links
