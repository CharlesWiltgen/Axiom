package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

// errNoBootedSim signals exit code 2 (environment error) to callers.
var errNoBootedSim = errors.New("no booted simulator found — boot one with: xcrun simctl boot <device>")

// pickBootedUDID returns the UDID of the first Booted device in `simctl
// list devices -j` output, or errNoBootedSim.
func pickBootedUDID(listJSON []byte) (string, error) {
	var parsed struct {
		Devices map[string][]struct {
			UDID  string `json:"udid"`
			State string `json:"state"`
		} `json:"devices"`
	}
	if err := json.Unmarshal(listJSON, &parsed); err != nil {
		return "", fmt.Errorf("parse simctl list: %w", err)
	}
	for _, devs := range parsed.Devices {
		for _, d := range devs {
			if d.State == "Booted" {
				return d.UDID, nil
			}
		}
	}
	return "", errNoBootedSim
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

// describeUI runs `axe describe-ui` for the resolved sim and parses the tree.
func describeUI(ctx context.Context, udid string) ([]AXElement, error) {
	res, err := ExecRun(ctx, 0, "axe", "describe-ui", "--udid", udid)
	if err != nil {
		return nil, fmt.Errorf("axe describe-ui: %w", err)
	}
	return parseDescribeUI(res.Stdout)
}
