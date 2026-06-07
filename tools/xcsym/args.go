package main

import "flag"

// parseInterspersed parses fs while allowing flags and positional arguments to
// appear in any order. The stdlib flag package stops at the first positional, so
// `cmd <file> --flag` silently drops the flag; this helper removes that footgun
// by peeling positionals out and re-parsing the remainder until none are left.
//
// Tokens after a literal "--" are returned as trailing positionals without flag
// interpretation, preserving standard terminator semantics. Flags are recorded
// on fs as usual. Returned positionals keep their original left-to-right order.
//
// All Axiom Go CLI tools must accept flags in any order (see issue axiom-v9in);
// this helper is the shared mechanism. It is duplicated per tool because each is
// a separate zero-dependency Go module.
func parseInterspersed(fs *flag.FlagSet, args []string) ([]string, error) {
	pre := args
	var afterDash []string
	for i, a := range args {
		if a == "--" {
			pre = args[:i]
			afterDash = args[i+1:]
			break
		}
	}

	var positionals []string
	rest := pre
	for {
		if err := fs.Parse(rest); err != nil {
			return nil, err
		}
		rest = fs.Args()
		if len(rest) == 0 {
			break
		}
		positionals = append(positionals, rest[0])
		rest = rest[1:]
	}
	return append(positionals, afterDash...), nil
}
