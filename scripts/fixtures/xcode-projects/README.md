# Xcode project compatibility fixtures

This pair represents one small disposable project in OpenStep and JSON5 formats. All names, identifiers, paths, package locations and scripts are synthetic. `pbxproj/Example.xcodeproj/project.pbxproj` is the input; Xcode 27.2 beta 2 (27B5028f) saved the JSON5 counterpart with:

```sh
xcrun xcodebuild -project Example.xcodeproj -convert-project 'Xcode Project'
```

The original OpenStep input was preserved before conversion. `provenance.json` records the file hashes and Apple decoder revision. The pinned `XcodeProjectFormat` decoder accepts the saved JSON5 and re-encodes it byte-identically. Conversion provides an Xcode-saved origin; neither file is copied from a private app.

## Contract

The project has three native targets, Debug and Release configurations, and Release as the default configuration. The extension has different deployment declarations from the app. Support omits its deployment declaration and inherits from the project configuration file.

| Selection                         | Declared deployment       | Effective deployment oracle |
| --------------------------------- | ------------------------- | --------------------------- |
| Primary, Debug or Release         | 26.5                      | 26.5                        |
| Extension, Debug, iphoneos        | 26.2                      | 26.2                        |
| Extension, Release, iphoneos      | 26.3                      | 26.3                        |
| Extension, Debug, iphonesimulator | 26.4 conditional override | 26.4                        |
| Support, Debug or Release         | omitted                   | 26.1 from Base.xcconfig     |

These values are fixture data, not recommended deployment targets. Both configurations include `Base.xcconfig`. Extension declares an architecture-conditioned `OTHER_SWIFT_FLAGS` value containing `-DARM64` for Debug/arm64. The shared include chain adds `-DBASE` and a configuration-specific flag. Raw declarations do not evaluate inheritance, SDK selection, architecture selection or defaults. The package-free `-showBuildSettings` checks confirm all deployment oracles; their general flags output does not include the architecture-conditioned flag, so per-architecture compiler flags remain unverified.

Other cases include scalar and array build settings, scalar and multiline-array scripts, string and object entries in the build-phase array, remote and local packages, package-product memberships, an explicit source-file membership, and a synchronized folder with an extension exclusion. Xcode saves the package version constraint and product build-phase reference as objects. It canonicalizes the architecture-conditioned flags into a scalar. The fixture keeps omitted default target kinds and required-capabilities fields omitted.

The `Sources/Excluded.swift` file exists in each control and is excluded from Extension's synchronized folder. `Shared.swift` belongs explicitly to Primary. The fixture is for project inspection. The remote package URL deliberately uses `example.invalid`; avoid package resolution or app builds on this pair. Effective-setting measurements use scratch-only copies with package references removed, retaining the settings and include chains.

## Verification

Run the ordinary contract and leak checks:

```sh
node --test scripts/project-fixtures.test.ts
```

On macOS, Foundation's JSON5 reader and `plutil` independently inspect the two file formats. On other hosts, the native format check is skipped and the leak check still runs. The test validates the configuration files actually copied by each format's workflow probes.

Run the pinned Apple decoder boundary checks by supplying its executable:

```sh
AXIOM_XCPROJ_FORMATTER=/path/to/pinned/xcprojformatter \
  node --test scripts/project-fixtures.test.ts
```

The decoder checks the valid fixture, missing required default configuration, an unsupported required capability, and malformed JSON5. The valid case also checks byte-identical encoding. The executable is intentionally external; this fixture task does not bundle a new tool.

## Workflow regressions

The opt-in suite extracts the literal commands from the selected source checkout and copies each fixture into temporary root, `ios/`, and `apps/ios/` layouts. It runs bash and zsh, includes a working root/Primary control, and gives each of the four build-performance settings its own test.

```sh
AXIOM_PROJECT_REGRESSION=1 \
AXIOM_PROJECT_SOURCE_ROOT=/path/to/axiom-checkout \
  node --test scripts/project-fixtures.test.ts
```

This suite is intentionally RED before the compatibility implementation. It expects deep discovery, extension/Release/SDK selection, inherited settings, nested build-performance lookups, and explicit errors for missing or ambiguous selection. It stays disabled in the normal green suite.

The adapter sets `PROJECT`, `TARGET`, `CONFIGURATION`, `SDK` and `SETTINGS_JSON` used by the literal documented `xcproject settings` command. It invokes Xcode only on temporary copies with package references removed, after checking for existing builds. It does not build or launch an app. Build-performance assertions compare selected effective values, including `ONLY_ACTIVE_ARCH=NO` for the device-query context; raw fixture declarations still record `YES`.

To replay existing independently recorded captures without invoking Xcode, set `AXIOM_PROJECT_ORACLE_REPLAY=/path/to/effective-settings.json`. Replays relocate only `PROJECT_FILE_PATH` to the copied fixture and leave all setting values unchanged. They test shell selection and the reader, not a fresh Xcode query or current runtime behavior. The CLI's separate retained-oracle test verifies all fourteen original captures without identity relocation.

Evidence logs and effective-setting measurements belong in task-owned scratch and the issue tracker. Do not commit logs with temporary or personal paths. Runtime/helper acceptance and distribution verification remain separate work.
