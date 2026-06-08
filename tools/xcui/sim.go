package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
)

// errNoBootedSim signals exit code 2 (environment error) to callers.
var errNoBootedSim = errors.New("no booted simulator found — boot one with: xcrun simctl boot <device>")

// bootedUDIDs returns the UDIDs of every Booted device in `simctl list devices
// -j` output, sorted. Sorting matters: Go map iteration order is randomized, so
// without it the pick varies across runs when more than one sim is booted.
// Returns an empty slice (not an error) when none are booted.
func bootedUDIDs(listJSON []byte) ([]string, error) {
	var parsed struct {
		Devices map[string][]struct {
			UDID  string `json:"udid"`
			State string `json:"state"`
		} `json:"devices"`
	}
	if err := json.Unmarshal(listJSON, &parsed); err != nil {
		return nil, fmt.Errorf("parse simctl list: %w", err)
	}
	var booted []string
	for _, devs := range parsed.Devices {
		for _, d := range devs {
			if d.State == "Booted" {
				booted = append(booted, d.UDID)
			}
		}
	}
	sort.Strings(booted)
	return booted, nil
}

// pickBootedUDID returns the first booted device's UDID in deterministic
// (sorted) order, or errNoBootedSim. With more than one sim booted the choice
// is stable across runs; pass --udid to target a specific one.
func pickBootedUDID(listJSON []byte) (string, error) {
	booted, err := bootedUDIDs(listJSON)
	if err != nil {
		return "", err
	}
	if len(booted) == 0 {
		return "", errNoBootedSim
	}
	return booted[0], nil
}

// resolveUDID returns explicit if non-empty, else the booted simulator's UDID.
func resolveUDID(ctx context.Context, explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}
	res, err := ExecRun(ctx, 0, "xcrun", "simctl", "list", "devices", "-j")
	if err != nil {
		return "", fmt.Errorf("simctl list devices: %w", err)
	}
	return pickBootedUDID(res.Stdout)
}

// resolveBootedInfo returns the target UDID plus the full sorted list of booted
// UDIDs. An explicit udid short-circuits enumeration (returned with a nil list).
// doctor uses the list to warn when more than one sim is booted.
func resolveBootedInfo(ctx context.Context, explicit string) (udid string, booted []string, err error) {
	if explicit != "" {
		return explicit, nil, nil
	}
	res, err := ExecRun(ctx, 0, "xcrun", "simctl", "list", "devices", "-j")
	if err != nil {
		return "", nil, fmt.Errorf("simctl list devices: %w", err)
	}
	booted, err = bootedUDIDs(res.Stdout)
	if err != nil {
		return "", nil, err
	}
	if len(booted) == 0 {
		return "", nil, errNoBootedSim
	}
	return booted[0], booted, nil
}

// describeUI runs `axe describe-ui` for the resolved sim and parses the tree.
func describeUI(ctx context.Context, udid string) ([]AXElement, error) {
	res, err := ExecRun(ctx, 0, "axe", "describe-ui", "--udid", udid)
	if err != nil {
		return nil, fmt.Errorf("axe describe-ui: %w", err)
	}
	return parseDescribeUI(res.Stdout)
}
