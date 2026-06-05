package main

import (
	"os"
	"testing"
)

// loadNetFixture reads the trimmed real network-connection-stat export (16
// interval rows over 13 connections, captured on macOS 26.5 / Instruments 16.0).
func loadNetFixture(t *testing.T) []byte {
	t.Helper()
	data, err := os.ReadFile("testdata/network-connection-stat.xml")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	return data
}

func TestParseNetworkStatAggregatesByConnection(t *testing.T) {
	// Expected values were computed independently from the fixture (see the
	// Python ground-truth pass in the Phase 2d work): 13 distinct connection
	// serials, summed rx/tx across each serial's interval rows.
	rep, err := parseNetworkStat(loadNetFixture(t), 15)
	if err != nil {
		t.Fatalf("parseNetworkStat: %v", err)
	}
	if rep.Connections != 13 {
		t.Errorf("Connections = %d, want 13", rep.Connections)
	}
	if rep.TotalRxBytes != 302474 {
		t.Errorf("TotalRxBytes = %d, want 302474", rep.TotalRxBytes)
	}
	if rep.TotalTxBytes != 4639 {
		t.Errorf("TotalTxBytes = %d, want 4639", rep.TotalTxBytes)
	}
}

func TestParseNetworkStatTopTalkerResolvesRefs(t *testing.T) {
	// The hottest connection by bytes is our own curl-local fetch of apple.com's
	// CDN. Its process is carried by a ref to an earlier row's id; getting the
	// name + pid right proves cross-row ref resolution works (the same dedup the
	// cpu-profile parser handles).
	rep, err := parseNetworkStat(loadNetFixture(t), 15)
	if err != nil {
		t.Fatalf("parseNetworkStat: %v", err)
	}
	if len(rep.TopByBytes) == 0 {
		t.Fatal("TopByBytes is empty")
	}
	got := rep.TopByBytes[0]
	want := NetConnection{
		Process:   "curl-local",
		PID:       59752,
		Protocol:  "tcp4",
		Interface: "Ethernet",
		Local:     "10.0.0.114:50479",
		Remote:    "23.61.213.25:443",
		RxBytes:   264996,
		TxBytes:   589,
		RxPackets: 30,
		TxPackets: 7,
		Intervals: 1,
	}
	if got != want {
		t.Errorf("TopByBytes[0]\n got = %+v\nwant = %+v", got, want)
	}
}

func TestParseNetworkStatTopNLimits(t *testing.T) {
	rep, err := parseNetworkStat(loadNetFixture(t), 3)
	if err != nil {
		t.Fatalf("parseNetworkStat: %v", err)
	}
	if len(rep.TopByBytes) != 3 {
		t.Errorf("TopByBytes length = %d, want 3 (limited)", len(rep.TopByBytes))
	}
	// Connections counts all distinct serials regardless of the top-N display cap.
	if rep.Connections != 13 {
		t.Errorf("Connections = %d, want 13", rep.Connections)
	}
}

func TestParseNetworkStatCountsUnattributedTraffic(t *testing.T) {
	// A row with byte counters but no connection serial (sentinel) can't be
	// attributed to a connection; it must be counted, not silently dropped, so a
	// shortfall in the totals is visible.
	in := []byte(`<?xml version="1.0"?><trace-query-result><node xpath='x'>` +
		`<schema name="network-connection-stat">` +
		`<col><mnemonic>connection-serial</mnemonic></col>` +
		`<col><mnemonic>rx-bytes</mnemonic></col></schema>` +
		`<row><sentinel/><network-size-in-bytes id="1" fmt="100 Bytes">100</network-size-in-bytes></row>` +
		`</node></trace-query-result>`)
	rep, err := parseNetworkStat(in, 15)
	if err != nil {
		t.Fatalf("parseNetworkStat: %v", err)
	}
	if rep.Connections != 0 {
		t.Errorf("Connections = %d, want 0 (row had no serial)", rep.Connections)
	}
	if rep.UnattributedRows != 1 {
		t.Errorf("UnattributedRows = %d, want 1", rep.UnattributedRows)
	}
	if rep.TotalRxBytes != 0 {
		t.Errorf("TotalRxBytes = %d, want 0 (unattributed traffic is not summed into a connection)", rep.TotalRxBytes)
	}
}

func TestParseNetworkStatEmptyTable(t *testing.T) {
	// A schema-only export (instrument recorded, no traffic) must parse to an
	// empty-but-valid report, never an error — the honesty contract distinguishes
	// "measured, nothing happened" from "couldn't measure".
	empty := []byte(`<?xml version="1.0"?><trace-query-result><node xpath='x'>` +
		`<schema name="network-connection-stat"><col><mnemonic>start-time</mnemonic></col>` +
		`<col><mnemonic>connection-serial</mnemonic></col></schema></node></trace-query-result>`)
	rep, err := parseNetworkStat(empty, 15)
	if err != nil {
		t.Fatalf("parseNetworkStat(empty): %v", err)
	}
	if rep.Connections != 0 || len(rep.TopByBytes) != 0 {
		t.Errorf("empty table: got Connections=%d Top=%d, want 0/0", rep.Connections, len(rep.TopByBytes))
	}
}
