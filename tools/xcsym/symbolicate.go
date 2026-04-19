package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// SymbolResult is a single atos resolution.
type SymbolResult struct {
	Raw          string // raw atos line
	Symbol       string
	File         string
	Line         int
	Symbolicated bool
}

// ResolveSingle resolves one address against a dSYM (or binary) at a given load address.
// arch may be empty to let atos choose.
func ResolveSingle(ctx context.Context, dsymOrBinary, arch, loadAddr, address string) (*SymbolResult, error) {
	args := []string{"-o", dsymOrBinary}
	if arch != "" {
		args = append(args, "-arch", arch)
	}
	args = append(args, "-l", loadAddr, address)
	res, err := ExecRun(ctx, 0, "atos", args...)
	if err != nil {
		return nil, err
	}
	line := strings.TrimSpace(string(res.Stdout))
	if line == "" {
		return nil, fmt.Errorf("atos returned empty output")
	}
	sym := parseAtosLine(line)
	return &sym, nil
}

// ResolveBatch resolves multiple addresses in one atos invocation for efficiency.
func ResolveBatch(ctx context.Context, dsymOrBinary, arch, loadAddr string, addresses []string) ([]*SymbolResult, error) {
	args := []string{"-o", dsymOrBinary}
	if arch != "" {
		args = append(args, "-arch", arch)
	}
	args = append(args, "-l", loadAddr)
	args = append(args, addresses...)
	res, err := ExecRun(ctx, 0, "atos", args...)
	if err != nil {
		return nil, err
	}
	var results []*SymbolResult
	sc := bufio.NewScanner(bytes.NewReader(res.Stdout))
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		sym := parseAtosLine(line)
		results = append(results, &sym)
	}
	if len(results) != len(addresses) {
		return nil, fmt.Errorf("atos returned %d lines for %d addresses", len(results), len(addresses))
	}
	return results, nil
}

// parseAtosLine extracts symbol/file/line from an atos output line.
// atos output shapes:
//   "Symbol (in Image)"                     — symbol, no source
//   "Symbol (in Image) + offset"            — symbol, no source
//   "Symbol (in Image) (File:Line)"         — fully symbolicated
//   "0xaddr (in Image)"                     — unsymbolicated (atos echoes the address)
//   "-[Class method] (in Image) ..."        — ObjC method
var atosLineRe = regexp.MustCompile(`^(.*?)\s*\(in\s+[^)]+\)(?:\s*\(([^:]+):(\d+)\))?(?:\s*\+\s*\d+)?\s*$`)

func parseAtosLine(line string) SymbolResult {
	sym := SymbolResult{Raw: line}
	m := atosLineRe.FindStringSubmatch(line)
	if m == nil {
		return sym
	}
	symbol := strings.TrimSpace(m[1])
	if strings.HasPrefix(symbol, "0x") {
		return sym // unsymbolicated
	}
	sym.Symbol = symbol
	sym.Symbolicated = true
	if m[2] != "" {
		sym.File = m[2]
	}
	if m[3] != "" {
		if n, err := strconv.Atoi(m[3]); err == nil {
			sym.Line = n
		}
	}
	return sym
}
