package main

import "testing"

func TestIsSystemFrame(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/usr/lib/system/libsystem_kernel.dylib", true},
		{"/usr/lib/dyld", true},
		{"/System/Library/Frameworks/UIKitCore.framework/UIKitCore", true},
		{"/usr/bin/yes", false},
		{"/Users/me/MyApp.app/MyApp", false},
	}
	for _, c := range cases {
		if got := isSystemFrame(Frame{BinaryPath: c.path}); got != c.want {
			t.Errorf("isSystemFrame(%q) = %v, want %v", c.path, got, c.want)
		}
	}
}

func TestIsUnsymbolicated(t *testing.T) {
	if !isUnsymbolicated(Frame{Name: "0x1024044f0"}) {
		t.Error("address name should be unsymbolicated")
	}
	if isUnsymbolicated(Frame{Name: "write"}) {
		t.Error("named frame should be symbolicated")
	}
}

func TestIsUserFrame(t *testing.T) {
	yes := Frame{Name: "main", BinaryName: "yes", BinaryPath: "/usr/bin/yes"}
	sys := Frame{Name: "write", BinaryName: "libsystem_kernel.dylib", BinaryPath: "/usr/lib/system/libsystem_kernel.dylib"}
	set := userBinarySet("yes", nil)
	if !isUserFrame(yes, set) {
		t.Error("target binary should be user code")
	}
	if isUserFrame(sys, set) {
		t.Error("system binary should not be user code")
	}
	// With no user set, any non-system frame is user code.
	if !isUserFrame(yes, nil) {
		t.Error("non-system frame should be user code when no set given")
	}
}

func TestUserBinarySetDropsEmpty(t *testing.T) {
	set := userBinarySet("yes", []string{"", "MyKit"})
	if set[""] {
		t.Error("empty binary name must not be added to the set")
	}
	if !set["yes"] || !set["MyKit"] {
		t.Errorf("expected target + hint in set, got %v", set)
	}
}
