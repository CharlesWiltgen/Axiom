package main

import "strings"

// systemPrefixes are binary paths owned by the OS/runtime. Frames from these
// bury app code in raw hot-function lists, so we separate them out.
var systemPrefixes = []string{
	"/System/",
	"/usr/lib/",
	"/Library/Apple/",
}

// isSystemFrame reports whether a frame belongs to the OS/runtime rather than
// user code. dyld and the dynamic-loader live under /usr/lib too.
func isSystemFrame(f Frame) bool {
	for _, p := range systemPrefixes {
		if strings.HasPrefix(f.BinaryPath, p) {
			return true
		}
	}
	return false
}

// isUnsymbolicated reports whether a frame name is a raw address (stripped
// binary, no dSYM) rather than a function name.
func isUnsymbolicated(f Frame) bool {
	return strings.HasPrefix(f.Name, "0x")
}

// userBinarySet builds the set of binary names treated as user code: the
// target process plus any explicit --user-binary hints. Empty names are
// dropped so a stray hint (e.g. a trailing comma) can't match nameless frames.
func userBinarySet(targetName string, hints []string) map[string]bool {
	set := map[string]bool{}
	if targetName != "" {
		set[targetName] = true
	}
	for _, h := range hints {
		if h != "" {
			set[h] = true
		}
	}
	return set
}

// attributedAsUser is the single user-code predicate shared by isUserFrame and
// the hot-frame filter. A system frame is never user code; with no explicit
// set, any non-system frame is user code; with a set, only the listed binaries
// (the target is always in the set) count, keeping attribution tight.
func attributedAsUser(isSystem bool, binaryName string, userBinaries map[string]bool) bool {
	if isSystem {
		return false
	}
	if len(userBinaries) == 0 {
		return true
	}
	return userBinaries[binaryName]
}

// isUserFrame reports whether a frame is app-attributed.
func isUserFrame(f Frame, userBinaries map[string]bool) bool {
	return attributedAsUser(isSystemFrame(f), f.BinaryName, userBinaries)
}
