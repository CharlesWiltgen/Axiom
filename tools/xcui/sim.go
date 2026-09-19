package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

// execRun is the subprocess seam for simulator resolution, so a test can assert
// which paths shell out (and which must not) instead of hitting the real simctl.
var execRun = ExecRun

// errNoBootedSim signals exit code 2 (environment error) to callers.
var errNoBootedSim = errors.New("no booted simulator found — boot one with: xcrun simctl boot <device>")

// bootedSim is one Booted device from `simctl list devices -j`. Runtime is the
// only field that tells same-named devices apart ("iPhone 17" on 26.5 and on 27).
type bootedSim struct {
	UDID    string `json:"udid"`
	Name    string `json:"name"`
	Runtime string `json:"runtime,omitempty"`
}

// bootedSims returns every Booted device, sorted by UDID. Sorting matters: Go map
// iteration order is randomized, so without it the listing would reorder across
// runs. Returns an empty slice (not an error) when none are booted.
func bootedSims(listJSON []byte) ([]bootedSim, error) {
	var parsed struct {
		Devices map[string][]struct {
			UDID  string `json:"udid"`
			State string `json:"state"`
			Name  string `json:"name"`
		} `json:"devices"`
	}
	if err := json.Unmarshal(listJSON, &parsed); err != nil {
		return nil, fmt.Errorf("parse simctl list: %w", err)
	}
	var booted []bootedSim
	for runtime, devs := range parsed.Devices {
		for _, d := range devs {
			if d.State == "Booted" {
				booted = append(booted, bootedSim{UDID: d.UDID, Name: d.Name, Runtime: runtimeLabel(runtime)})
			}
		}
	}
	sort.Slice(booted, func(i, j int) bool { return booted[i].UDID < booted[j].UDID })
	return booted, nil
}

// runtimeLabel turns "com.apple.CoreSimulator.SimRuntime.iOS-26-5" into "iOS 26.5".
// A key that doesn't carry the prefix is returned unchanged rather than dropped; one
// with the prefix but no version keeps just the platform, so a listing never shows a
// 36-character identifier where a name belongs.
func runtimeLabel(key string) string {
	const prefix = "com.apple.CoreSimulator.SimRuntime."
	if !strings.HasPrefix(key, prefix) {
		return key
	}
	platform, version, ok := strings.Cut(strings.TrimPrefix(key, prefix), "-")
	if !ok {
		return platform
	}
	return platform + " " + strings.ReplaceAll(version, "-", ".")
}

// simLabel renders a device for a human-readable listing. simctl names frequently
// already carry the OS version ("iPhone 17 (27)"), so the runtime is appended only
// when it adds something — otherwise the line reads "iPhone 17 (27) (iOS 27.0)".
func simLabel(s bootedSim) string {
	if s.Runtime == "" {
		return s.Name
	}
	version := s.Runtime
	if _, v, ok := strings.Cut(s.Runtime, " "); ok {
		version = v
	}
	major, _, _ := strings.Cut(version, ".")
	if strings.Contains(s.Name, "("+version+")") || strings.Contains(s.Name, "("+major+")") {
		return s.Name
	}
	return s.Name + " (" + s.Runtime + ")"
}

// ambiguousSimError refuses to pick a device when more than one is booted and the
// caller named none. A silent pick drove the wrong simulator while every tap
// printed ✓, so the refusal lists each candidate for a one-step --udid retry.
type ambiguousSimError struct{ sims []bootedSim }

func (e *ambiguousSimError) Error() string {
	var b strings.Builder
	fmt.Fprintf(&b, "%d simulators are booted and no --udid was given; refusing to guess which one to drive. "+
		"Re-run with --udid set to one of:", len(e.sims))
	for _, s := range e.sims {
		fmt.Fprintf(&b, "\n  %s  %s", s.UDID, simLabel(s))
	}
	return b.String()
}

// pickBootedUDID returns the only booted device's UDID. It returns errNoBootedSim
// when none is booted and *ambiguousSimError when several are.
func pickBootedUDID(listJSON []byte) (string, error) {
	booted, err := bootedSims(listJSON)
	if err != nil {
		return "", err
	}
	switch len(booted) {
	case 0:
		return "", errNoBootedSim
	case 1:
		return booted[0].UDID, nil
	default:
		return "", &ambiguousSimError{sims: booted}
	}
}

// resolveUDID returns explicit if non-empty, else the booted simulator's UDID.
func resolveUDID(ctx context.Context, explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}
	res, err := execRun(ctx, 0, "xcrun", "simctl", "list", "devices", "-j")
	if err != nil {
		return "", fmt.Errorf("simctl list devices: %w", err)
	}
	return pickBootedUDID(res.Stdout)
}

// resolveBootedInfo returns the target UDID plus every booted device. An explicit
// udid short-circuits enumeration (returned with a nil list). Unlike resolveUDID it
// never refuses: doctor reports the booted set instead of acting on one device.
func resolveBootedInfo(ctx context.Context, explicit string) (udid string, booted []bootedSim, err error) {
	if explicit != "" {
		return explicit, nil, nil
	}
	res, err := execRun(ctx, 0, "xcrun", "simctl", "list", "devices", "-j")
	if err != nil {
		return "", nil, fmt.Errorf("simctl list devices: %w", err)
	}
	booted, err = bootedSims(res.Stdout)
	if err != nil {
		return "", nil, err
	}
	if len(booted) == 0 {
		return "", nil, errNoBootedSim
	}
	return booted[0].UDID, booted, nil
}

// describeUI runs `axe describe-ui` for the resolved sim and parses the tree.
func describeUI(ctx context.Context, udid string) ([]AXElement, error) {
	res, err := runAxe(ctx, 0, "describe-ui", "--udid", udid)
	if err != nil {
		return nil, fmt.Errorf("axe describe-ui: %w", err)
	}
	return parseDescribeUI(res.Stdout)
}
