# App Launch Performance Debugging

Systematic app launch performance optimization with comprehensive profiling across all iOS architectures.

## Overview

App launch performance directly impacts user retention and App Store ratings. This skill provides systematic approaches to measure, diagnose, and optimize all launch scenarios including cold, warm, hot, and push notification launches.

**Core principle**: Measure launch phases systematically with App Launch Instrument before optimizing. 80% of launch issues stem from main thread blocking, excessive pre-main work, or framework loading overhead.

## When to Use

- App takes >2 seconds from tap to first usable screen
- Users complain app is "slow to start" or "takes forever to load"
- Cold launch after device reboot is noticeably slow
- Push notification response time is too slow
- App launch performance has regressed after recent changes
- Preparing for App Store submission and optimizing user experience

## Key Features

### Launch Phase Analysis
- **Pre-main optimization** - Dyld loading, framework resolution, static initializers
- **Main thread analysis** - Application delegate, view controller setup, SwiftUI App lifecycle
- **First frame timing** - UI appearance and interactive readiness
- **Custom completion points** - App-specific launch milestones

### Comprehensive Architecture Support
- **UIKit AppDelegate** patterns (Objective-C and Swift)
- **SwiftUI App** lifecycle optimization
- **Mixed codebases** with UIKit/SwiftUI integration
- **Legacy Objective-C** static initialization patterns

### Launch Type Optimization
| Launch Type | Target | Common Issues |
|-------------|---------|---------------|
| **Cold** | <1.5s | Framework loading, disk I/O |
| **Warm** | <1.0s | App initialization, main thread work |
| **Hot** | <0.5s | State restoration, view updates |
| **Push Launch** | <1.0s | Notification processing, deep link routing |

### Push Notification Performance
- **UNUserNotificationCenter** handler optimization
- **Deep link routing** performance patterns
- **Background app refresh** integration for pre-warming
- **Notification payload processing** strategies

### Production Monitoring
- **MetricKit** integration for field performance monitoring
- **XCTest** performance testing automation
- **OSSignposter** custom launch metrics
- **Device-specific** performance baselines

## Performance Targets

### iPhone Targets
| Device Class | Cold Launch | Warm Launch | Hot Launch |
|--------------|-------------|-------------|------------|
| **iPhone 15 Pro** | <1.0s | <0.7s | <0.3s |
| **iPhone 14** | <1.2s | <0.8s | <0.4s |
| **iPhone 13** | <1.4s | <1.0s | <0.5s |
| **iPhone 12** | <1.6s | <1.2s | <0.6s |

### iPad Targets
| Device Class | Cold Launch | Warm Launch | Hot Launch |
|--------------|-------------|-------------|------------|
| **iPad Pro M2** | <0.8s | <0.5s | <0.2s |
| **iPad Air** | <1.2s | <0.8s | <0.4s |
| **iPad (9th gen)** | <1.8s | <1.4s | <0.7s |

## Workflow Overview

### 1. Measurement Phase
- Configure App Launch Instrument template
- Record launch scenarios on real device
- Identify slow phases using timeline analysis
- Establish baseline metrics

### 2. Optimization Phase
- Pre-main: Reduce framework count, defer static work
- Main thread: Optimize AppDelegate/App initialization
- First frame: Streamline view hierarchy setup
- Post-launch: Background critical path work

### 3. Testing Phase
- Automated XCTest performance regression tests
- Manual testing across device types
- Push notification response time validation
- Production monitoring setup

## Common Launch Issues

### Pre-Main Problems
- Too many dynamic frameworks (>10)
- Heavy Objective-C `+load` methods
- Complex Swift static initialization
- Excessive static globals computation

### Main Thread Blocking
- Synchronous file I/O during launch
- Database setup on main thread
- Network calls in AppDelegate
- Heavy view controller initialization

### Push Notification Issues
- Heavy payload processing in notification handlers
- Complex deep link resolution blocking UI
- Missing background app refresh optimization
- Poor notification-to-content response time

## Requirements

- **iOS 15+** for comprehensive App Launch Instrument support
- **Xcode 14+** for enhanced launch metrics
- **Real device testing** (Simulator results unreliable for launch timing)
- **App Launch Instrument** profiling workflow

## Getting Started

The skill provides step-by-step workflows for:

1. **App Launch Instrument Setup** - Configuration and recording
2. **Timeline Analysis** - Reading profiling results effectively
3. **Code Optimization** - Specific patterns for each architecture
4. **Production Integration** - MetricKit and automated testing
5. **Push Notification Optimization** - Specialized notification launch patterns

## Related Skills

- **[Performance Profiling](/skills/debugging/performance-profiling)** - General Instruments usage patterns
- **[Memory Debugging](/skills/debugging/memory-debugging)** - Launch memory spike investigation
- **[Xcode Debugging](/skills/debugging/xcode-debugging)** - Environment setup issues
- **[Energy Optimization](/skills/debugging/energy)** - Launch battery impact analysis

## WWDC Resources

- **WWDC 2019-423** (Optimizing App Launch)
- **WWDC 2022-10056** (App Launch Best Practices)
- **WWDC 2023-10181** (Analyze hang reports with performance tools)
- **Technical Note TN2434** (App Launch Performance)