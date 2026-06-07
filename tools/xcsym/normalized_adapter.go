package main

import (
	"strconv"
	"strings"
)

// normalizeTerminationCode renders a termination/mach code as "0x<lowerhex>"
// so EqualFold checks in the rule engine match regardless of provider
// encoding. Hex strings are lowercased; decimal strings are converted; an
// unrecognized string is returned lowercased unchanged.
func normalizeTerminationCode(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(s), "0x") {
		return strings.ToLower(s)
	}
	if i, err := strconv.ParseInt(s, 10, 64); err == nil {
		if i < 0 {
			return "0x" + strconv.FormatUint(uint64(i), 16)
		}
		return "0x" + strconv.FormatInt(i, 16)
	}
	if u, err := strconv.ParseUint(s, 10, 64); err == nil {
		return "0x" + strconv.FormatUint(u, 16)
	}
	return strings.ToLower(s)
}
