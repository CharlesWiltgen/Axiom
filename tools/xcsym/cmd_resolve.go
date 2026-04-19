package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
)

type resolveOutput struct {
	Tool    string          `json:"tool"`
	Version string          `json:"version"`
	Dsym    string          `json:"dsym"`
	Arch    string          `json:"arch,omitempty"`
	Load    string          `json:"load_addr"`
	Results []resolveResult `json:"results"`
}

type resolveResult struct {
	Address      string `json:"address"`
	Raw          string `json:"raw"`
	Symbol       string `json:"symbol,omitempty"`
	File         string `json:"file,omitempty"`
	Line         int    `json:"line,omitempty"`
	Symbolicated bool   `json:"symbolicated"`
}

// runResolve implements `xcsym resolve`. Returns the intended exit code so the
// caller (main) can os.Exit with it, and tests can assert against it directly.
//
// Exit codes (see plan):
//
//	0 success · 1 usage · 2 input not found · 5 tool error · 6 timeout · 8 output error
func runResolve(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("resolve", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	dsym := fs.String("dsym", "", "dSYM or binary path (required)")
	arch := fs.String("arch", "", "architecture slice (arm64, arm64e, x86_64)")
	load := fs.String("load-addr", "", "load address (required)")
	if err := fs.Parse(args); err != nil {
		return 1
	}
	if *dsym == "" || *load == "" {
		fmt.Fprintln(os.Stderr, "resolve: --dsym and --load-addr are required")
		return 1
	}
	if fs.NArg() == 0 {
		fmt.Fprintln(os.Stderr, "resolve: at least one address required")
		return 1
	}
	if _, err := os.Stat(*dsym); err != nil {
		fmt.Fprintf(os.Stderr, "resolve: dSYM not found: %s\n", *dsym)
		return 2
	}

	syms, err := ResolveBatch(context.Background(), *dsym, *arch, *load, fs.Args())
	if err != nil {
		if IsTimeoutError(err) {
			fmt.Fprintf(os.Stderr, "resolve: %v\n", err)
			return 6
		}
		fmt.Fprintf(os.Stderr, "resolve: %v\n", err)
		return 5
	}

	result := resolveOutput{
		Tool:    "xcsym",
		Version: version,
		Dsym:    *dsym,
		Arch:    *arch,
		Load:    *load,
	}
	for i, addr := range fs.Args() {
		s := syms[i]
		result.Results = append(result.Results, resolveResult{
			Address:      addr,
			Raw:          s.Raw,
			Symbol:       s.Symbol,
			File:         s.File,
			Line:         s.Line,
			Symbolicated: s.Symbolicated,
		})
	}
	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	if err := enc.Encode(result); err != nil {
		fmt.Fprintf(os.Stderr, "resolve: %v\n", err)
		return 8
	}
	return 0
}
