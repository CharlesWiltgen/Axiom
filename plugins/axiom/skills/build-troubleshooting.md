---
name: build-troubleshooting
description: Use when encountering dependency conflicts, CocoaPods/SPM resolution failures, "Multiple commands produce" errors, or framework version mismatches - systematic dependency and build configuration debugging for iOS projects
---

# Build Troubleshooting

## Overview

Check dependencies BEFORE blaming code. **Core principle:** 80% of persistent build failures are dependency resolution issues (CocoaPods, SPM, framework conflicts), not code bugs.

## Red Flags - Dependency/Build Issues

If you see ANY of these, suspect dependency problem:
- "No such module" after adding package
- "Multiple commands produce" same output file
- Build succeeds on one machine, fails on another
- CocoaPods install succeeds but build fails
- SPM resolution takes forever or times out
- Framework version conflicts in error logs

## Quick Decision Tree

```
Build failing?
├─ "No such module XYZ"?
│  ├─ After adding SPM package?
│  │  └─ Clean build folder + reset package caches
│  ├─ After pod install?
│  │  └─ Check Podfile.lock conflicts
│  └─ Framework not found?
│     └─ Check FRAMEWORK_SEARCH_PATHS
├─ "Multiple commands produce"?
│  └─ Duplicate files in target membership
├─ SPM resolution hangs?
│  └─ Clear package caches + derived data
└─ Version conflicts?
   └─ Use dependency resolution strategies below
```

## Common Build Issues

### Issue 1: SPM Package Not Found

**Symptom**: "No such module PackageName" after adding Swift Package

**❌ WRONG**:
```bash
# Rebuilding without cleaning
xcodebuild build
```

**✅ CORRECT**:
```bash
# Reset package caches first
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf ~/Library/Caches/org.swift.swiftpm

# Reset packages in project
xcodebuild -resolvePackageDependencies

# Clean build
xcodebuild clean build -scheme YourScheme
```

### Issue 2: CocoaPods Conflicts

**Symptom**: Pod install succeeds but build fails with framework errors

**Check Podfile.lock**:
```bash
# See what versions were actually installed
cat Podfile.lock | grep -A 2 "PODS:"

# Compare with Podfile requirements
cat Podfile | grep "pod "
```

**Fix version conflicts**:
```ruby
# Podfile - be explicit about versions
pod 'Alamofire', '~> 5.8.0'  # Not just 'Alamofire'
pod 'SwiftyJSON', '5.0.1'     # Exact version if needed
```

**Clean reinstall**:
```bash
# Remove all pods
rm -rf Pods/
rm Podfile.lock

# Reinstall
pod install

# Open workspace (not project!)
open YourApp.xcworkspace
```

### Issue 3: Multiple Commands Produce Error

**Symptom**: "Multiple commands produce '/path/to/file'"

**Cause**: Same file added to multiple targets or build phases

**Fix**:
1. Open Xcode
2. Select file in navigator
3. File Inspector → Target Membership
4. Uncheck duplicate targets
5. Or: Build Phases → Copy Bundle Resources → remove duplicates

### Issue 4: Framework Search Paths

**Symptom**: "Framework not found" or "Linker command failed"

**Check build settings**:
```bash
# Show all build settings
xcodebuild -showBuildSettings -scheme YourScheme | grep FRAMEWORK_SEARCH_PATHS
```

**Fix in Xcode**:
1. Target → Build Settings
2. Search "Framework Search Paths"
3. Add path: `$(PROJECT_DIR)/Frameworks` (recursive)
4. Or: `$(inherited)` to inherit from project

### Issue 5: SPM Version Conflicts

**Symptom**: Package resolution fails with version conflicts

**See dependency graph**:
```bash
# In project directory
swift package show-dependencies

# Or see resolved versions
cat Package.resolved
```

**Fix conflicts**:
```swift
// Package.swift - be explicit
.package(url: "https://github.com/owner/repo", exact: "1.2.3")  // Exact version
.package(url: "https://github.com/owner/repo", from: "1.2.0")   // Minimum version
.package(url: "https://github.com/owner/repo", .upToNextMajor(from: "1.0.0"))  // SemVer
```

**Reset resolution**:
```bash
# Clear package caches
rm -rf .build
rm Package.resolved

# Re-resolve
swift package resolve
```

## Dependency Resolution Strategies

### Strategy 1: Lock to Specific Versions

When stability matters more than latest features:

**CocoaPods**:
```ruby
pod 'Alamofire', '5.8.0'      # Exact version
pod 'SwiftyJSON', '~> 5.0.0'  # Any 5.0.x
```

**SPM**:
```swift
.package(url: "...", exact: "1.2.3")
```

### Strategy 2: Use Version Ranges

When you want bug fixes but not breaking changes:

**CocoaPods**:
```ruby
pod 'Alamofire', '~> 5.8'     # 5.8.x but not 5.9
pod 'SwiftyJSON', '>= 5.0', '< 6.0'  # Range
```

**SPM**:
```swift
.package(url: "...", from: "1.2.0")              // 1.2.0 and higher
.package(url: "...", .upToNextMajor(from: "1.0.0"))  // 1.x.x but not 2.0.0
```

### Strategy 3: Fork and Pin

When you need custom modifications:

```bash
# Fork repo on GitHub
# Clone your fork
git clone https://github.com/yourname/package.git

# In Package.swift, use your fork
.package(url: "https://github.com/yourname/package", branch: "custom-fixes")
```

### Strategy 4: Exclude Transitive Dependencies

When a dependency's dependency conflicts:

**SPM (not directly supported, use workarounds)**:
```swift
// Instead of this:
.package(url: "https://github.com/problematic/package")

// Fork it and remove the conflicting dependency from its Package.swift
```

**CocoaPods**:
```ruby
# Exclude specific subspecs
pod 'Firebase/Core'  # Not all of Firebase
pod 'Firebase/Analytics'
```

## Build Configuration Issues

### Debug vs Release Differences

**Symptom**: Builds in Debug, fails in Release (or vice versa)

**Check optimization settings**:
```bash
# Compare Debug and Release settings
xcodebuild -showBuildSettings -configuration Debug > debug.txt
xcodebuild -showBuildSettings -configuration Release > release.txt
diff debug.txt release.txt
```

**Common culprits**:
- SWIFT_OPTIMIZATION_LEVEL (-Onone vs -O)
- ENABLE_TESTABILITY (YES in Debug, NO in Release)
- DEBUG preprocessor flag
- Code signing settings

### Workspace vs Project

**Always open workspace with CocoaPods**:
```bash
# ❌ WRONG
open YourApp.xcodeproj

# ✅ CORRECT
open YourApp.xcworkspace
```

**Check which you're building**:
```bash
# For workspace
xcodebuild -workspace YourApp.xcworkspace -scheme YourScheme build

# For project only (no CocoaPods)
xcodebuild -project YourApp.xcodeproj -scheme YourScheme build
```

## Testing Checklist

### When Adding Dependencies
- [ ] Specify exact versions or ranges (not just latest)
- [ ] Check for known conflicts with existing deps
- [ ] Test clean build after adding
- [ ] Commit lockfile (Podfile.lock or Package.resolved)

### When Builds Fail
- [ ] Run mandatory environment checks (xcode-debugging skill)
- [ ] Check dependency lockfiles for changes
- [ ] Verify using correct workspace/project file
- [ ] Compare working vs broken build settings

### Before Shipping
- [ ] Test both Debug and Release builds
- [ ] Verify all dependencies have compatible licenses
- [ ] Check binary size impact of dependencies
- [ ] Test on clean machine or CI

## Common Mistakes

### ❌ Not Committing Lockfiles
```bash
# ❌ BAD: .gitignore includes lockfiles
Podfile.lock
Package.resolved
```

**Why**: Team members get different versions, builds differ

### ❌ Using "Latest" Version
```ruby
# ❌ BAD: No version specified
pod 'Alamofire'
```

**Why**: Breaking changes when dependency updates

### ❌ Mixing Package Managers
```
Project uses both:
- CocoaPods (Podfile)
- Carthage (Cartfile)
- SPM (Package.swift)
```

**Why**: Conflicts are inevitable, pick one primary manager

### ❌ Not Cleaning After Dependency Changes
```bash
# ❌ BAD: Just rebuild
xcodebuild build

# ✅ GOOD: Clean first
xcodebuild clean build
```

### ❌ Opening Project Instead of Workspace
When using CocoaPods, always open .xcworkspace not .xcodeproj

## Command Reference

```bash
# CocoaPods
pod install                    # Install dependencies
pod update                     # Update to latest versions
pod update PodName             # Update specific pod
pod outdated                   # Check for updates
pod deintegrate                # Remove CocoaPods from project

# Swift Package Manager
swift package resolve          # Resolve dependencies
swift package update           # Update dependencies
swift package show-dependencies # Show dependency tree
swift package reset            # Reset package cache
xcodebuild -resolvePackageDependencies  # Xcode's SPM resolve

# Carthage
carthage update                # Update dependencies
carthage bootstrap             # Download pre-built frameworks
carthage build --platform iOS  # Build for specific platform

# Xcode Build
xcodebuild clean               # Clean build folder
xcodebuild -list               # List schemes and targets
xcodebuild -showBuildSettings  # Show all build settings
```

## Real-World Impact

**Before** (trial-and-error with dependencies):
- Dependency issue: 2-4 hours debugging
- Clean builds not run consistently
- Version conflicts surprise team
- CI failures from dependency mismatches

**After** (systematic dependency management):
- Dependency issue: 15-30 minutes (check lockfile → resolve)
- Clean builds mandatory after dep changes
- Explicit version constraints prevent surprises
- CI matches local builds (committed lockfiles)

**Key insight:** Lock down dependency versions early. Flexibility causes more problems than it solves.

## Reference

**Apple Documentation**:
- [Swift Package Manager](https://swift.org/package-manager/)
- [Xcode Build System](https://developer.apple.com/documentation/xcode/build-system)

**Package Managers**:
- [CocoaPods](https://cocoapods.org/)
- [Carthage](https://github.com/Carthage/Carthage)

**Note**: For environment issues (Derived Data, simulators), see xcode-debugging skill.
