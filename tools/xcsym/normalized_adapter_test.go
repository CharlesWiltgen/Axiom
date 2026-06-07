package main

import "testing"

func TestNormalizeTerminationCode(t *testing.T) {
	cases := map[string]string{
		"0xDEAD10CC": "0xdead10cc",
		"0xdead10cc": "0xdead10cc",
		"3735883980": "0xdead10cc", // decimal form of 0xdead10cc
		"0x8BADF00D": "0x8badf00d",
		"":           "",
		"garbage":    "garbage", // pass-through, lowercased
	}
	for in, want := range cases {
		if got := normalizeTerminationCode(in); got != want {
			t.Errorf("normalizeTerminationCode(%q) = %q, want %q", in, got, want)
		}
	}
}
