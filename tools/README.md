# Axiom Go CLI Tools

Standalone command-line tools that ship with Axiom. Each is a separate, **zero-dependency** Go module (no third-party `require` block), built as a universal macOS binary and bundled into the plugin and the npm package.

| Tool | Purpose |
|------|---------|
| `xclog` | Capture simulator/device console output as structured JSON |
| `xcsym` | Symbolicate and triage `.ips`, MetricKit, `.crash`, and `.xccrashpoint` crashes |
| `xcui` | Drive and assert on the simulator UI and accessibility tree |
| `xcprof` | Record and analyze xctrace/Instruments CPU profiles |

## Contributor requirements

### Argument-order independence (axiom-v9in)

Every subcommand of every tool **must** accept flags and positional arguments in any order. Both of these must behave identically:

```
xcsym crash --format=standard <file>
xcsym crash <file> --format=standard
```

Go's stdlib `flag` package stops parsing at the first positional, so flags placed after a positional are silently dropped. This is an arbitrary papercut for both human and LLM callers, so we remove it everywhere.

**How:** each module carries a copy of `parseInterspersed` in `args.go`. Replace the usual `fs.Parse(args)` + `fs.Arg(n)` pattern with it:

```go
positionals, err := parseInterspersed(fs, args)
if err != nil {
    return usageExitCode
}
// positionals holds the non-flag args in order; flags are set on fs regardless of position
```

`parseInterspersed` honors the `--` terminator (tokens after a literal `--` stay positionals), so launch-style commands that forward an argument list keep working.

The helper is **duplicated** per module rather than shared, because each tool is its own zero-dependency module — a shared package would mean a cross-module dependency. Keep the copies byte-for-byte identical; verify with:

```sh
cd tools && for t in xcsym xcui xcprof; do diff -q xclog/args.go $t/args.go; done
```

**Test:** every tool has at least one subcommand-level test proving `<cmd> <positional> --flag` and `<cmd> --flag <positional>` produce identical results. Add one when you add a subcommand.

### Token-lean output

These tools are consumed mostly by LLMs. Emit compact JSON / JSONL / terse markdown by default, never pretty-printed, without sacrificing quality.
