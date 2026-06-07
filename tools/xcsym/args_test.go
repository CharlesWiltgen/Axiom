package main

import (
	"flag"
	"io"
	"reflect"
	"testing"
)

// parseInterspersed must let flags and positionals appear in any order and must
// honor the "--" terminator. Both orders of the same logical command must yield
// identical flag values and positionals.
func TestParseInterspersed(t *testing.T) {
	cases := []struct {
		name      string
		args      []string
		wantStr   string
		wantBool  bool
		wantPosns []string
	}{
		{"flags before positional", []string{"--name=alice", "--verbose", "file.txt"}, "alice", true, []string{"file.txt"}},
		{"flags after positional", []string{"file.txt", "--name=alice", "--verbose"}, "alice", true, []string{"file.txt"}},
		{"flags surrounding positional", []string{"--name=alice", "file.txt", "--verbose"}, "alice", true, []string{"file.txt"}},
		{"space-form flag after positional", []string{"file.txt", "--name", "alice"}, "alice", false, []string{"file.txt"}},
		{"multiple positionals interspersed", []string{"a", "--name=x", "b", "--verbose", "c"}, "x", true, []string{"a", "b", "c"}},
		{"double-dash keeps later flags as positionals", []string{"--name=x", "real", "--", "--verbose", "tail"}, "x", false, []string{"real", "--verbose", "tail"}},
		{"no args", nil, "", false, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			fs := flag.NewFlagSet("test", flag.ContinueOnError)
			name := fs.String("name", "", "")
			verbose := fs.Bool("verbose", false, "")
			got, err := parseInterspersed(fs, c.args)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if *name != c.wantStr {
				t.Errorf("name = %q, want %q", *name, c.wantStr)
			}
			if *verbose != c.wantBool {
				t.Errorf("verbose = %v, want %v", *verbose, c.wantBool)
			}
			if !reflect.DeepEqual(got, c.wantPosns) {
				t.Errorf("positionals = %#v, want %#v", got, c.wantPosns)
			}
		})
	}
}

// An undefined flag must still surface as an error (the helper must not swallow
// genuine parse failures while reordering).
func TestParseInterspersedRejectsUnknownFlag(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	_ = fs.String("name", "", "")
	if _, err := parseInterspersed(fs, []string{"file.txt", "--bogus"}); err == nil {
		t.Fatal("expected an error for an undefined flag, got nil")
	}
}
