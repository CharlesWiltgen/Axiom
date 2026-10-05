# Installation check

Run `node "<installed-axiom-root>/scripts/doctor.mjs"` from any working directory.
Node.js 18 or later is required. The check reads this package and runs only the
bundled helpers' help commands, with a three-second limit per helper.
It never launches or installs MCP servers, reads credentials or Codex settings,
or changes hooks, trust, configuration, or the installed cache. Helper output is discarded.

The JSON report separates local package integrity from live capabilities.
MCP startup is unpinned: `npx -y axiom-mcp` resolves the latest published
release, so `mcp.status` is `unpinned` and `configuredVersion` is null. A
configuration hand-edited to an exact version reports `pinned` with that version;
other forms report `invalid`. `observedVersion` is unknown without live host
evidence, and `versionMatch` compares it only against an exact pin.
Hook files do not prove host compatibility or trust. Xcode integration is optional.
Host trust, server connection, and Xcode availability remain `unknown` unless
the caller explicitly exports sanitized, structured host metadata and supplies
`--host-metadata <file>`. Do not pass authentication or configuration files.

Optional metadata (maximum 64 KiB):

```json
{
  "runtimeVersion": "0.154.0-alpha.6.2",
  "hookTrust": "trusted",
  "mcp": { "status": "connected", "version": "27.3.0" },
  "xcode": { "status": "unknown", "version": null }
}
```

Each field is optional. Trust accepts `trusted`, `untrusted`, or `unknown`;
MCP status accepts `connected`, `unavailable`, or `unknown`; Xcode status
accepts `available`, `unavailable`, or `unknown`. Versions use numeric
major.minor.patch with an optional prerelease suffix. Unknown fields are discarded.
Caller-supplied observations are labelled `host.status: caller_supplied`.
Malformed metadata is labelled `invalid` without copying its content.

Exit 1 indicates broken package checks, failed helper probes, or invalid metadata.
Unknown or unavailable optional host capabilities do not fail the check.
Mach-O helpers on other platforms report `unsupported_platform`.
Use `--package-root <path>` to inspect another explicitly selected package.

## Optional hook diagnostics

Set `AXIOM_HOOK_DIAGNOSTICS_DIR` to an absolute local directory path to record
hook lifecycle metadata. A missing directory is created with mode 0700; its parent
must already exist. Existing directories must be owned by you with mode 0700.
The owner-only `axiom-hooks.jsonl` journal is capped at 1 MiB; archive or remove
it yourself when full. Symlinks, nonregular files, and files with multiple links
are refused. Diagnostics are disabled when the variable is unset.

Records contain only fixed hook/event identifiers, start/end phase, generated
correlation, elapsed time, outcome, and an allowlisted exception class. They exclude
prompts, paths, tool input/output, host session IDs, and exception messages.
An unavailable destination produces a fixed notice on stderr while preserving
the hook's protocol and exit behavior. Forced termination can leave only a start
record; use host evidence to distinguish cancellation, signals, and timeouts.
