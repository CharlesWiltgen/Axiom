package main

import (
	"flag"
	"fmt"
	"io"
	"os"
)

// runAnonymize implements `xcsym anonymize <file>`. Returns the exit code.
//
// Exit codes:
//
//	0 success — anonymized payload written to stdout (or --output)
//	1 usage error
//	2 input not found / unsupported format
//	5 anonymization failed (malformed JSON, etc.)
//	8 output write error
func runAnonymize(out io.Writer, args []string) int {
	fs := flag.NewFlagSet("anonymize", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	outputPath := fs.String("output", "", "write anonymized crash to this path instead of stdout")
	if err := fs.Parse(args); err != nil {
		return 1
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "anonymize: exactly one crash file required (use '-' for stdin)")
		return 1
	}

	var data []byte
	var err error
	path := fs.Arg(0)
	if path == "-" {
		data, err = io.ReadAll(os.Stdin)
		if err != nil {
			fmt.Fprintf(os.Stderr, "anonymize: read stdin: %v\n", err)
			return 2
		}
	} else {
		data, err = os.ReadFile(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "anonymize: cannot read %s: %v\n", path, err)
			return 2
		}
	}

	out2, err := Anonymize(data)
	if err != nil {
		fmt.Fprintf(os.Stderr, "anonymize: %v\n", err)
		return 5
	}

	var w io.Writer = out
	if *outputPath != "" {
		f, err := os.Create(*outputPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "anonymize: %v\n", err)
			return 8
		}
		defer f.Close()
		w = f
	}
	if _, err := w.Write(out2); err != nil {
		fmt.Fprintf(os.Stderr, "anonymize: %v\n", err)
		return 8
	}
	// Trailing newline for tty readability (json.MarshalIndent doesn't add one).
	if len(out2) > 0 && out2[len(out2)-1] != '\n' {
		_, _ = w.Write([]byte{'\n'})
	}
	return 0
}
