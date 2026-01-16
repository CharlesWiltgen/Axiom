---
name: axiom-xctrace-ref
description: Use when automating Instruments profiling, running headless performance analysis, or integrating profiling into CI/CD - comprehensive xctrace CLI reference with record/export patterns
user-invocable: true
skill_type: reference
version: 1.0.0
---

# xctrace CLI Reference

Command-line interface for Instruments profiling. Enables headless performance analysis without GUI.

## Overview

`xctrace` is the CLI tool behind Instruments.app. Use it for:
- Automated profiling in CI/CD pipelines
- Headless trace collection without GUI
- Programmatic trace analysis via XML export
- Performance regression detection

**Requires**: Xcode 12+ (xctrace 12.0+). This reference tested with Xcode 26.2.

## Quick Reference

```bash
# Record a 10-second CPU profile
xcrun xctrace record --instrument 'CPU Profiler' --attach 'MyApp' --time-limit 10s --output profile.trace

# Export to XML for analysis
xcrun xctrace export --input profile.trace --toc  # See available tables
xcrun xctrace export --input profile.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="cpu-profile"]'

# List available instruments
xcrun xctrace list instruments

# List available templates
xcrun xctrace list templates
```

## Recording Traces

### Basic Recording

```bash
# Using an instrument (recommended for CLI automation)
xcrun xctrace record --instrument 'CPU Profiler' --attach 'AppName' --time-limit 10s --output trace.trace

# Using a template (may fail on export in Xcode 26+)
xcrun xctrace record --template 'Time Profiler' --attach 'AppName' --time-limit 10s --output trace.trace
```

**Note**: In Xcode 26+, use `--instrument` instead of `--template` for reliable export. Templates may produce traces with "Document Missing Template Error" on export.

### Target Selection

```bash
# Attach to running process by name
xcrun xctrace record --instrument 'CPU Profiler' --attach 'MyApp' --time-limit 10s

# Attach to running process by PID
xcrun xctrace record --instrument 'CPU Profiler' --attach 12345 --time-limit 10s

# Profile all processes
xcrun xctrace record --instrument 'CPU Profiler' --all-processes --time-limit 10s

# Launch and profile
xcrun xctrace record --instrument 'CPU Profiler' --launch -- /path/to/app arg1 arg2

# Target specific device (simulator or physical)
xcrun xctrace record --instrument 'CPU Profiler' --device 'iPhone 17 Pro' --attach 'MyApp' --time-limit 10s
xcrun xctrace record --instrument 'CPU Profiler' --device 947DF45C-4ACB-4B3E-A043-DF2CD59A59B3 --all-processes --time-limit 10s
```

### Recording Options

| Flag | Description |
|------|-------------|
| `--output <path>` | Output .trace file path |
| `--time-limit <time>` | Recording duration (e.g., `10s`, `1m`, `500ms`) |
| `--no-prompt` | Skip privacy warnings (use in automation) |
| `--append-run` | Add run to existing trace |
| `--run-name <name>` | Name the recording run |

## Core Instruments

### CPU Profiler
CPU sampling for finding hot functions.

```bash
xcrun xctrace record --instrument 'CPU Profiler' --attach 'MyApp' --time-limit 10s --output cpu.trace
```

**Schema**: `cpu-profile`
**Columns**: time, thread, process, core, thread-state, weight (cycles), stack

### Allocations
Memory allocation tracking.

```bash
xcrun xctrace record --instrument 'Allocations' --attach 'MyApp' --time-limit 30s --output alloc.trace
```

**Schema**: `allocations`
**Use for**: Finding memory growth, object counts, allocation patterns

### Leaks
Memory leak detection.

```bash
xcrun xctrace record --instrument 'Leaks' --attach 'MyApp' --time-limit 30s --output leaks.trace
```

**Schema**: `leaks`
**Use for**: Detecting unreleased memory, retain cycles

### SwiftUI
SwiftUI view body analysis.

```bash
xcrun xctrace record --instrument 'SwiftUI' --attach 'MyApp' --time-limit 10s --output swiftui.trace
```

**Schema**: `swiftui`
**Use for**: Finding excessive view updates, body re-evaluations

### Swift Concurrency
Actor and Task analysis.

```bash
xcrun xctrace record --instrument 'Swift Tasks' --instrument 'Swift Actors' --attach 'MyApp' --time-limit 10s --output concurrency.trace
```

**Schemas**: `swift-task`, `swift-actor`
**Use for**: Task scheduling, actor isolation, async performance

## All Available Instruments

```
Activity Monitor          Audio Client              Audio Server
Audio Statistics          CPU Counters              CPU Profiler
Core Animation Activity   Core Animation Commits    Core Animation FPS
Core Animation Server     Core ML                   Data Faults
Data Fetches              Data Saves                Disk I/O Latency
Disk Usage                Display                   Filesystem Activity
Filesystem Suggestions    Foundation Models         Frame Lifetimes
GCD Performance           GPU                       HTTP Traffic
Hangs                     Hitches                   Leaks
Location Energy Model     Metal Application         Metal GPU Counters
Metal Performance Overview Metal Resource Events    Network Connections
Neural Engine             Points of Interest        Power Profiler
Processor Trace           RealityKit Frames         RealityKit Metrics
Runloops                  Sampler                   SceneKit Application
Swift Actors              Swift Tasks               SwiftUI
System Call Trace         System Load               Thread States
Time Profiler             VM Tracker                Virtual Memory Trace
```

## Exporting Traces

### Table of Contents

```bash
# See all available data tables in a trace
xcrun xctrace export --input trace.trace --toc
```

Output structure:
```xml
<trace-toc>
    <run number="1">
        <info>
            <target>...</target>
            <summary>...</summary>
        </info>
        <processes>...</processes>
        <data>
            <table schema="cpu-profile" .../>
            <table schema="thread-info"/>
            <table schema="process-info"/>
        </data>
    </run>
</trace-toc>
```

### XPath Export

```bash
# Export specific table by schema
xcrun xctrace export --input trace.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="cpu-profile"]'

# Export process info
xcrun xctrace export --input trace.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="process-info"]'

# Export thread info
xcrun xctrace export --input trace.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="thread-info"]'
```

### CPU Profile Schema

```xml
<schema name="cpu-profile">
    <col><mnemonic>time</mnemonic><name>Sample Time</name></col>
    <col><mnemonic>thread</mnemonic><name>Thread</name></col>
    <col><mnemonic>process</mnemonic><name>Process</name></col>
    <col><mnemonic>core</mnemonic><name>Core</name></col>
    <col><mnemonic>thread-state</mnemonic><name>State</name></col>
    <col><mnemonic>weight</mnemonic><name>Cycles</name></col>
    <col><mnemonic>stack</mnemonic><name>Backtrace</name></col>
</schema>
```

Each row contains:
- `sample-time`: Timestamp in nanoseconds
- `thread`: Thread ID and name
- `process`: Process name and PID
- `core`: CPU core number
- `thread-state`: Running, Blocked, etc.
- `cycle-weight`: CPU cycles
- `backtrace`: Call stack with function names

## Process Discovery

### Find Running Simulator Apps

```bash
# List apps in booted simulator
xcrun simctl spawn booted launchctl list | grep UIKitApplication

# Output format: PID  Status  com.apple.UIKitApplication:com.bundle.id[xxxx][rb-legacy]
```

### Find Device UUID

```bash
# List booted simulators (JSON)
xcrun simctl list devices booted -j

# List all devices
xcrun simctl list devices
```

### Find Process by Name

```bash
# Get PID of running app
pgrep -f "MyApp"

# List all processes with app name
ps aux | grep MyApp
```

## Automation Patterns

### CI/CD Integration

```bash
#!/bin/bash
# performance-test.sh

APP_NAME="MyApp"
TRACE_DIR="./traces"
TIME_LIMIT="30s"

# Boot simulator if needed
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true

# Wait for app to launch
sleep 5

# Record CPU profile
xcrun xctrace record \
    --instrument 'CPU Profiler' \
    --device "iPhone 17 Pro" \
    --attach "$APP_NAME" \
    --time-limit "$TIME_LIMIT" \
    --no-prompt \
    --output "$TRACE_DIR/cpu.trace"

# Export for analysis
xcrun xctrace export \
    --input "$TRACE_DIR/cpu.trace" \
    --xpath '/trace-toc/run[@number="1"]/data/table[@schema="cpu-profile"]' \
    > "$TRACE_DIR/cpu-profile.xml"

# Parse and check thresholds
# (Use xmllint, python, or custom tool to parse XML)
```

### Before/After Comparison

```bash
# Record baseline
xcrun xctrace record --instrument 'CPU Profiler' --attach 'MyApp' --time-limit 10s --output baseline.trace

# Make changes, rebuild app

# Record after changes
xcrun xctrace record --instrument 'CPU Profiler' --attach 'MyApp' --time-limit 10s --output after.trace

# Export both for comparison
xcrun xctrace export --input baseline.trace --xpath '...' > baseline.xml
xcrun xctrace export --input after.trace --xpath '...' > after.xml
```

## Troubleshooting

### "Document Missing Template Error" on Export

**Cause**: Recording used `--template` flag in Xcode 26+
**Fix**: Use `--instrument` instead:
```bash
# Instead of
xcrun xctrace record --template 'Time Profiler' ...

# Use
xcrun xctrace record --instrument 'CPU Profiler' ...
```

### "Unable to attach to process"

**Causes**:
1. Process not running
2. Insufficient permissions
3. System Integrity Protection blocking

**Fix**:
```bash
# Verify process exists
pgrep -f "AppName"

# For simulator apps, verify simulator is booted
xcrun simctl list devices booted

# Try with --all-processes instead of --attach
xcrun xctrace record --instrument 'CPU Profiler' --all-processes --time-limit 5s
```

### Empty Trace Export

**Cause**: Recording too short or no activity during recording
**Fix**: Increase `--time-limit` or ensure app is actively used during recording

### Symbolication Issues

Raw addresses in backtraces (e.g., `0x18f17ed94`) instead of function names.

**Fix**: Ensure dSYMs are available:
```bash
# Symbolicate trace (if needed)
xcrun xctrace symbolicate --input trace.trace --dsym /path/to/App.dSYM
```

## Limitations

1. **Privacy restrictions**: Some instruments require privacy permissions granted in System Preferences
2. **Device support**: Physical device profiling requires Developer Mode enabled
3. **Background apps**: Limited profiling of backgrounded apps
4. **Export format**: XML only (no JSON export)
5. **Template vs Instrument**: In Xcode 26+, templates may not export properly

## Resources

**Skills**: axiom-performance-profiling, axiom-memory-debugging, axiom-swiftui-performance

**Docs**: /xcode/instruments, /os/logging/recording-performance-data
