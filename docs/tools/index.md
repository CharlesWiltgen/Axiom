# Tools

Axiom's command-line helpers, built for Apple Silicon Macs, capture build diagnostics, simulator logs, crash reports and Instruments traces, inspect project structure, and drive and check the simulator's UI and accessibility.

Your assistant runs each helper from the installed plugin's `tools/` folder after checking that it works. In Claude Code, Axiom's session hook adds that folder to your `PATH`; in Codex, your assistant calls each helper by its full path; in Pi, you link them yourself ([Pi setup](/start/pi-install#command-line-helpers)). Cursor and other MCP clients reach xclog, xcsym and xcprof as tools of [Axiom's MCP server](/start/mcp-install), and, with a shell, run xcproject with `npx -y -p axiom-mcp xcproject`.

## Bundled tools

| Tool | What it does |
|------|--------------|
| [**axbuild**](#axbuild) | Run `xcodebuild`, `swift build` or `swift test` and get a short JSON summary of errors and failed tests, while the full log and report are saved |
| [**xcproject**](#xcproject) | Inspect Xcode project structure and read captured build settings without modifying the project |
| [**xclog**](/reference/xclog-ref) | Capture simulator and device console output (`print`, `os_log`, `Logger`) as structured JSON/JSONL |
| [**xcprof**](/reference/xcprof-ref) | Record and analyze Instruments traces — CPU bottlenecks attributed to your own code, and a clear report of what it couldn't measure rather than a false "no findings" |
| [**xcsym**](/reference/xcsym-ref) | Symbolicate and triage crash reports (`.ips`, MetricKit, legacy `.crash`, `.xccrashpoint`) with automatic dSYM discovery |
| [**xcui**](/reference/xcui-ref) | Drive and assert on the simulator UI and accessibility tree — wait for elements, check them, toggle accessibility settings, handle system dialogs, verify VoiceOver |

xclog, xcsym, xcui and xcprof's `record`, `compare` and `doctor` emit **compact JSON by default**, which costs your assistant few tokens; pass `--human` for a prose view, or pipe to `jq .` for indented JSON. xcprof's `analyze` defaults to a short markdown report; pass `--json` for JSON.

## axbuild

Use axbuild when a build or test might produce more output than your assistant can show, or when you need failure locations and test values afterward. Put axbuild in front of the command you'd normally run, keeping your scheme, destination and flags. Before starting an Xcode build, check whether another `xcodebuild` is already running, and find out why if one is. In Claude Code, `axbuild` is already on your `PATH`, so the bare name works; elsewhere, replace `<plugin-root>` below with the installed plugin's folder (in Codex, the one containing `.codex-plugin/plugin.json`).

```sh
"<plugin-root>/tools/axbuild" --help
pgrep -lx xcodebuild; echo "pgrep exit=$?"
"<plugin-root>/tools/axbuild" xcodebuild -scheme App -destination 'platform=macOS' build
"<plugin-root>/tools/axbuild" swift test --package-path ./Package
```

By default axbuild prints compact JSON of at most 8,000 bytes; `--format json` indents it. Check `command` (did the build or test succeed?) and `collection` (did axbuild gather every detail?) separately, because a successful build can still have incomplete collection. `omissions` lists what the summary left out. The complete report is `artifacts.report` inside the `artifacts.run` directory, whose path axbuild prints when it starts. Commands that only print information, such as `xcodebuild -list` or `swift --version`, pass through unchanged.

The saved compiler log is the main source of errors; test results and Swift Testing events add to it. If the command printed terminal color codes, as SwiftPM does even into a file, `artifacts.log` in the report names a copy without them; the exact output stays beside it as `build.log`. Keep the result bundle (`.xcresult`) for attachments, coverage and deeper inspection. If axbuild can't tell exactly how many tests failed, the count is `null`, meaning unknown, not zero. Read an existing saved log or report before rebuilding.

### Availability

The Claude Code and Codex plugins include axbuild. In Pi, put it on your `PATH`. Cursor and other MCP clients don't include it, so your assistant saves build output to a log file and reads that instead.

axbuild has been tested with Swift 6.4 (6.4.0.34.1, from Xcode 27.0 through 27.2 beta 2) and Swift 6.4.2 (6.4.2.1.9, from the Xcode 27.2 RC (27B48) and release (27B52)). With other toolchains, `swift test` runs without automatic Swift Testing event capture and axbuild relies on the log. Xcode 26 hasn't been tested. axbuild is supported on macOS 26 and newer, like the rest of Axiom.

### Known limitations

- If you cancel a build or it times out, axbuild also stops the build scripts Xcode started for it, including ones in separate process groups. Jobs that had already left the build, such as background daemons, keep running. If axbuild reports `cleanup-incomplete`, something it found could not be stopped or checked; confirm it belongs to the cancelled build before stopping it yourself.
- Progress text occasionally ends up inside an error's file name in the saved log. axbuild then can't identify the file, marks collection as partial and leaves the text as printed. Check the saved raw log.

Example prompt: "Run the tests and show me where the failing assertion is and what values it compared."

## xcproject

Use xcproject to see what an Xcode project declares: its targets, configurations, build settings, packages and build phases, in either project format (`project.pbxproj` or the JSON5 `project.xcproj`). It only reads files; it never runs Xcode or changes the project. As with axbuild, replace `<plugin-root>` below with the installed plugin's folder, or use the bare name in Claude Code.

```sh
"<plugin-root>/tools/xcproject" discover --root .
"<plugin-root>/tools/xcproject" inspect --project App.xcodeproj --target App --configuration Debug
"<plugin-root>/tools/xcproject" settings --project App.xcodeproj --input settings.json --target App --configuration Debug --sdk iphoneos --key SWIFT_COMPILATION_MODE
```

`inspect` reports what the project declares, including conditional settings and xcconfig references, never the value Xcode ends up using. For that value, `settings` reads a saved `xcodebuild -showBuildSettings -json` capture and checks that it matches the project, target, configuration and SDK you name. That `xcodebuild` query can resolve packages or write build state, so your assistant asks before running it.

### Availability

The Claude Code and Codex plugins include xcproject. In Pi, put it on your `PATH`. Cursor and other MCP clients with a shell run it from the MCP server's package with `npx -y -p axiom-mcp xcproject`; it has no MCP tool, so a client without a shell reads the project files instead.

Example prompt: "Which targets in this project set SWIFT_COMPILATION_MODE, and what does Debug actually use?"

## How they fit in

Each tool has a slash command that uses it and, where it makes sense, an agent that drives it:

| Tool | Command | Agent |
|------|---------|-------|
| axbuild | [`/axiom:fix-build`](/commands/build/fix-build), [`/axiom:run-tests`](/commands/testing/run-tests) | [build-fixer](/agents/build-fixer), [test-runner](/agents/test-runner) |
| xcproject | [`/axiom:status`](/commands/utility/status), [`/axiom:optimize-build`](/commands/build/optimize-build) | [build-optimizer](/agents/build-optimizer), [spm-conflict-resolver](/agents/spm-conflict-resolver) |
| xclog | [`/axiom:console`](/commands/debugging/console) | — |
| xcprof | [`/axiom:profile`](/commands/debugging/profile) | [performance-profiler](/agents/performance-profiler) |
| xcsym | [`/axiom:analyze-crash`](/commands/debugging/analyze-crash) | [crash-analyzer](/agents/crash-analyzer) |
| xcui | [`/axiom:ui`](/commands/testing/ui) | [simulator-tester](/agents/simulator-tester) |

You rarely call these directly — Axiom's skills and agents invoke them for you. The reference pages linked in [Bundled tools](#bundled-tools) document xclog, xcprof, xcsym and xcui for when you want to drive them yourself; axbuild and xcproject are covered on this page.

## Related tools

Axiom also documents the third-party and Apple command-line tools the bundled tools build on:

- [**AXe**](/reference/axe-ref) – Simulator input automation; `xcui` delegates input (`tap`/`type`/`swipe`) to it.
- [**xctrace**](/reference/xctrace-ref) – Apple's Instruments command-line tool; `xcprof` wraps it for recording and export.
