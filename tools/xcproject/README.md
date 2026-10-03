# xcproject

Read-only Xcode project inspection, built with Swift 6.4 or newer. Axiom supports macOS 26 and newer. The universal binary reads `project.pbxproj` and Xcode's JSON5 `project.xcproj` inside the unchanged `.xcodeproj` container.

```sh
make test
make install
xcproject --help
xcproject discover --root .
xcproject inspect --project 'apps/ios/Example.xcodeproj' --target Extension --configuration Debug
```

Discovery skips dependency/cache directories and directory symlinks. Missing projects and ambiguous selection fail with a diagnostic. `inspect` without target/configuration returns inventory; it never chooses the first target or a default configuration for a settings query. Its `declarations` dictionary preserves the source format's structure. JSON5 is validated by Apple's typed `XcodeProjectFormat` library pinned in `Package.swift` and `Package.resolved`.

## Packaged invocation

Claude Code and Pi carry the inspector under the canonical plugin's `bin/xcproject`; Codex carries `bin/xcproject` inside its generated package. Invoke the absolute package path when `command -v xcproject` is empty. The MCP npm package exposes the same native executable as its `xcproject` CLI and includes Apple's license. It has no `axiom_xcproject_*` MCP wrapper. Cursor and other MCP clients without shell access must use the documented file-reading fallback.

`make install` records the pre-build source inputs and installed binary/license hashes in the canonical plugin's `build-info/xcproject.json`. The pre-deploy gate verifies those bytes in the working tree and Git index, plus Codex artifact parity. This build record checks artifact integrity; runtime compatibility requires execution on a supported OS.

## Effective settings

`inspect` returns declarations. Conditional keys, arrays, inherited values, xcconfig include chains, packages/products, script bodies and membership exceptions remain available for structural analysis. Effective settings come from Xcode.

After authorization to query the selected project, capture Xcode's output into a task-owned file. The query can create build-system state or resolve packages; do not run it against a project authorized only for file reads. It does not build or launch the app.

```sh
# Set PROJECT, TARGET, CONFIGURATION, SDK and SETTINGS_JSON explicitly.
# Check existing processes and investigate active builds before starting a query.
pgrep -x xcodebuild | wc -l
if xcrun xcodebuild -project "$PROJECT" -target "$TARGET" -configuration "$CONFIGURATION" -sdk "$SDK" -showBuildSettings -json > "$SETTINGS_JSON"; then
  xcproject settings --project "$PROJECT" --input "$SETTINGS_JSON" --target "$TARGET" --configuration "$CONFIGURATION" --sdk "$SDK" --key IPHONEOS_DEPLOYMENT_TARGET
else
  query_status=$?
  echo "Xcode settings query failed for $PROJECT/$TARGET/$CONFIGURATION/$SDK (exit $query_status)" >&2
  exit "$query_status"
fi
```

The reader verifies the capture's project path, target, configuration and SDK identity, then returns the requested nonempty string. `--value-only` emits only the value. `--arch arm64` requires `ARCHS` to contain only that architecture; it does **not** establish evaluation of architecture-conditioned compiler flags. Inspect those declarations and verify the actual compiler invocation when needed. A captured file records a past query; regenerate it after any project, xcconfig, environment or selection change. This tool launches no subprocesses and never modifies the project.

## Structural relationships

For JSON5, read the selected target's `build-settings`, `build-phases`, `build-rules` and `package-product-members`, the top-level `packages`, and the `files` tree. Build-phase entries may be strings or objects. Script bodies may be strings or arrays of lines. Folder `target-membership` and `membership-exceptions` describe membership rules, not an enumerated set of source files. Resolve paths relative to their group/base and apply exclusions before claiming effective membership.

For OpenStep, follow `rootObject` into `objects`: `PBXProject.targets`, each target's `buildConfigurationList`, `buildPhases`, `buildRules`, `packageProductDependencies` and `fileSystemSynchronizedGroups`; follow referenced package, file, phase and exception objects. Do not flatten the graph or discard omitted defaults. Both formats may reference xcconfig files outside the project container.

## Dependency license

Apple's `xcode-project-format` is Apache-2.0 with the Swift runtime library exception. Its complete license and attribution are retained in `THIRD_PARTY_LICENSE.txt`; Axiom's own inspector code uses the repository's MIT license. The build pins the exact upstream revision, and the universal binary contains arm64 and x86_64 slices.
