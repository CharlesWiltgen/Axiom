package main

import (
	"encoding/xml"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// The network-connection-stat table reports per-connection socket statistics
// over 1-second intervals — one row per connection per interval. Unlike
// cpu-profile, its rows use GENERIC element names (two <sockaddr>, four
// <event-count>/<network-size-in-bytes>) distinguished only by column POSITION,
// so we map cells to the schema's <col> mnemonics by index rather than by tag.
// Values are deduplicated with the same id/ref scheme cpu-profile uses: the
// first occurrence carries id="N" + content, later cells reference it with
// ref="N". We register every id (recursively) in document order, then resolve.

// NetConnection is one socket connection, summed across its interval rows.
type NetConnection struct {
	Process   string `json:"process,omitempty"`
	PID       int    `json:"pid,omitempty"`
	Protocol  string `json:"protocol,omitempty"`
	Interface string `json:"interface,omitempty"`
	Local     string `json:"local,omitempty"`
	Remote    string `json:"remote,omitempty"`
	RxBytes   int64  `json:"rx_bytes"`
	TxBytes   int64  `json:"tx_bytes"`
	RxPackets int64  `json:"rx_packets"`
	TxPackets int64  `json:"tx_packets"`
	Intervals int    `json:"intervals"` // stat rows aggregated into this connection
}

// NetworkReport summarizes the network-connection-stat table for one trace.
// UnattributedRows counts interval rows that carried traffic but no connection
// serial — so a shortfall in the totals is never silent (the honesty contract).
type NetworkReport struct {
	Connections      int             `json:"connections"`
	TotalRxBytes     int64           `json:"total_rx_bytes"`
	TotalTxBytes     int64           `json:"total_tx_bytes"`
	UnattributedRows int             `json:"unattributed_rows,omitempty"`
	TopByBytes       []NetConnection `json:"top_by_bytes,omitempty"`
}

type netStatResult struct {
	XMLName xml.Name     `xml:"trace-query-result"`
	Cols    []string     `xml:"node>schema>col>mnemonic"`
	Rows    []netStatRow `xml:"node>row"`
}

type netStatRow struct {
	Cells []netCell `xml:",any"`
}

// netCell is one value cell. Children captures nested elements (a <process>'s
// <pid>, a <formatted-label>'s parts) so id registration can recurse and never
// miss a definition that a later ref points at.
type netCell struct {
	XMLName  xml.Name
	ID       string    `xml:"id,attr"`
	Ref      string    `xml:"ref,attr"`
	Fmt      string    `xml:"fmt,attr"`
	Value    string    `xml:",chardata"`
	Children []netCell `xml:",any"`
}

// rcell is a resolved cell: fmt for display fields (protocol, addresses), value
// (raw chardata) for exact counters, pid lifted from a nested <pid>.
type rcell struct {
	fmt   string
	value string
	pid   int
}

func toRcell(c netCell) rcell {
	r := rcell{fmt: c.Fmt, value: strings.TrimSpace(c.Value)}
	for _, ch := range c.Children {
		if ch.XMLName.Local == "pid" {
			r.pid = atoiSafe(strings.TrimSpace(ch.Value))
			if r.pid == 0 {
				r.pid = atoiSafe(ch.Fmt)
			}
		}
	}
	return r
}

func atoiSafe(s string) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return 0
	}
	return n
}

func atoi64(s string) int64 {
	n, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	if err != nil {
		return 0
	}
	return n
}

// splitProcessName turns "curl-local (59752)" into "curl-local". The pid is read
// separately from the nested <pid>, so a missing/odd suffix just leaves the
// fmt as-is.
func splitProcessName(fmtStr string) string {
	if i := strings.LastIndex(fmtStr, " ("); i >= 0 {
		return fmtStr[:i]
	}
	return fmtStr
}

// parseNetworkStat resolves the network-connection-stat export and aggregates
// interval rows into per-connection totals, returning the topN connections by
// total bytes. A schema-only export (no rows) yields a valid empty report.
func parseNetworkStat(data []byte, topN int) (NetworkReport, error) {
	var raw netStatResult
	if err := xml.Unmarshal(data, &raw); err != nil {
		return NetworkReport{}, fmt.Errorf("parse network-connection-stat: %w", err)
	}
	cols := raw.Cols
	idtab := map[string]rcell{}
	var register func(c netCell)
	register = func(c netCell) {
		if c.ID != "" {
			idtab[c.ID] = toRcell(c)
		}
		for _, ch := range c.Children {
			register(ch)
		}
	}
	// Pass 1: register every id across all rows. xctrace declares an id before any
	// ref to it, but a full pre-pass makes that ordering a non-assumption — a
	// forward ref (should Apple ever emit one) still resolves correctly.
	for _, row := range raw.Rows {
		for _, c := range row.Cells {
			register(c)
		}
	}
	resolve := func(c netCell) rcell {
		if c.Ref != "" {
			return idtab[c.Ref]
		}
		return toRcell(c)
	}

	// Pass 2: resolve each row positionally and aggregate by connection serial.
	bySerial := map[string]*NetConnection{}
	order := make([]string, 0, len(raw.Rows))
	var unattributed int
	for _, row := range raw.Rows {
		rec := make(map[string]rcell, len(cols))
		for i, c := range row.Cells {
			if i >= len(cols) {
				break
			}
			rec[cols[i]] = resolve(c)
		}
		rxb := atoi64(rec["rx-bytes"].value)
		txb := atoi64(rec["tx-bytes"].value)
		rxp := atoi64(rec["rx-packets"].value)
		txp := atoi64(rec["tx-packets"].value)
		serial := rec["connection-serial"].fmt
		if serial == "" {
			// A row carrying real traffic but no serial can't be attributed —
			// count it so the totals' shortfall is visible, never silent.
			if rxb|txb|rxp|txp != 0 {
				unattributed++
			}
			continue
		}
		a := bySerial[serial]
		if a == nil {
			proc := rec["process"]
			a = &NetConnection{
				Process:   splitProcessName(proc.fmt),
				PID:       proc.pid,
				Protocol:  rec["protocol"].fmt,
				Interface: rec["interface"].fmt,
				Local:     rec["local-address"].fmt,
				Remote:    rec["remote-address"].fmt,
			}
			bySerial[serial] = a
			order = append(order, serial)
		}
		a.RxBytes += rxb
		a.TxBytes += txb
		a.RxPackets += rxp
		a.TxPackets += txp
		a.Intervals++
	}

	rep := NetworkReport{Connections: len(order), UnattributedRows: unattributed}
	conns := make([]NetConnection, 0, len(order))
	for _, s := range order {
		c := bySerial[s]
		rep.TotalRxBytes += c.RxBytes
		rep.TotalTxBytes += c.TxBytes
		conns = append(conns, *c)
	}
	sort.SliceStable(conns, func(i, j int) bool {
		return conns[i].RxBytes+conns[i].TxBytes > conns[j].RxBytes+conns[j].TxBytes
	})
	if topN > 0 && len(conns) > topN {
		conns = conns[:topN]
	}
	rep.TopByBytes = conns
	return rep, nil
}
