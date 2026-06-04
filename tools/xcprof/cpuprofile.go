package main

import (
	"encoding/xml"
	"fmt"
	"strings"
)

// xctrace export deduplicates repeated values: the first occurrence carries
// id="N" and the full content; later rows reference it with ref="N" and an
// empty body. A naive parser sees empty backtraces on every row after the
// first — the silent gap this tool exists to close. We unmarshal the rows,
// then resolve refs in document order (declaration always precedes reference).

type cpResult struct {
	XMLName xml.Name `xml:"trace-query-result"`
	Rows    []cpRow  `xml:"node>row"`
}

type cpRow struct {
	SampleTime  cpScalar    `xml:"sample-time"`
	Thread      cpThread    `xml:"thread"`
	CycleWeight cpScalar    `xml:"cycle-weight"`
	Backtrace   cpBacktrace `xml:"tagged-backtrace"`
}

// cpScalar covers id/ref-tagged leaf values (sample-time, cycle-weight).
type cpScalar struct {
	ID    string `xml:"id,attr"`
	Ref   string `xml:"ref,attr"`
	Value int64  `xml:",chardata"`
}

type cpThread struct {
	ID  string `xml:"id,attr"`
	Ref string `xml:"ref,attr"`
	Fmt string `xml:"fmt,attr"`
}

type cpBacktrace struct {
	ID     string    `xml:"id,attr"`
	Ref    string    `xml:"ref,attr"`
	Frames []cpFrame `xml:"backtrace>frame"`
}

type cpFrame struct {
	ID     string   `xml:"id,attr"`
	Ref    string   `xml:"ref,attr"`
	Name   string   `xml:"name,attr"`
	Addr   string   `xml:"addr,attr"`
	Binary cpBinary `xml:"binary"`
}

type cpBinary struct {
	ID       string `xml:"id,attr"`
	Ref      string `xml:"ref,attr"`
	Name     string `xml:"name,attr"`
	Path     string `xml:"path,attr"`
	UUID     string `xml:"UUID,attr"`
	Arch     string `xml:"arch,attr"`
	LoadAddr string `xml:"load-addr,attr"`
}

// Frame is a resolved backtrace frame (leaf-first within a Sample).
// UUID/Arch/LoadAddr come from the frame's <binary> and feed --dsym
// symbolication (matching the dSYM by UUID, then atos with the load address).
type Frame struct {
	Name       string `json:"name"`
	Addr       string `json:"addr,omitempty"`
	BinaryName string `json:"binary,omitempty"`
	BinaryPath string `json:"path,omitempty"`
	UUID       string `json:"uuid,omitempty"`
	Arch       string `json:"arch,omitempty"`
	LoadAddr   string `json:"load_addr,omitempty"`
}

// Sample is one resolved cpu-profile row.
type Sample struct {
	TimeNS       int64   `json:"t_ns"`
	Weight       int64   `json:"weight"`
	ThreadName   string  `json:"thread,omitempty"`
	IsMainThread bool    `json:"main,omitempty"`
	Frames       []Frame `json:"frames,omitempty"`
}

// resolver holds the id tables used to expand ref="N" back-references.
type resolver struct {
	threads    map[string]cpThread
	backtraces map[string][]Frame
	frames     map[string]Frame
	binaries   map[string]cpBinary
	weights    map[string]int64
	times      map[string]int64
}

func newResolver() *resolver {
	return &resolver{
		threads:    map[string]cpThread{},
		backtraces: map[string][]Frame{},
		frames:     map[string]Frame{},
		binaries:   map[string]cpBinary{},
		weights:    map[string]int64{},
		times:      map[string]int64{},
	}
}

func (r *resolver) scalar(table map[string]int64, s cpScalar) int64 {
	if s.Ref != "" {
		return table[s.Ref]
	}
	if s.ID != "" {
		table[s.ID] = s.Value
	}
	return s.Value
}

func (r *resolver) thread(t cpThread) cpThread {
	if t.Ref != "" {
		return r.threads[t.Ref]
	}
	if t.ID != "" {
		r.threads[t.ID] = t
	}
	return t
}

func (r *resolver) binary(b cpBinary) cpBinary {
	if b.Ref != "" {
		return r.binaries[b.Ref]
	}
	if b.ID != "" {
		r.binaries[b.ID] = b
	}
	return b
}

func (r *resolver) frame(f cpFrame) Frame {
	if f.Ref != "" {
		return r.frames[f.Ref]
	}
	bin := r.binary(f.Binary)
	resolved := Frame{
		Name: f.Name, Addr: f.Addr,
		BinaryName: bin.Name, BinaryPath: bin.Path,
		UUID: bin.UUID, Arch: bin.Arch, LoadAddr: bin.LoadAddr,
	}
	if f.ID != "" {
		r.frames[f.ID] = resolved
	}
	return resolved
}

func (r *resolver) backtrace(bt cpBacktrace) []Frame {
	if bt.Ref != "" {
		return r.backtraces[bt.Ref]
	}
	frames := make([]Frame, 0, len(bt.Frames))
	for _, f := range bt.Frames {
		frames = append(frames, r.frame(f))
	}
	if bt.ID != "" {
		r.backtraces[bt.ID] = frames
	}
	return frames
}

// parseCPUProfile unmarshals a `cpu-profile` table export and resolves every
// id/ref back-reference into fully-populated Samples.
func parseCPUProfile(data []byte) ([]Sample, error) {
	var raw cpResult
	if err := xml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse cpu-profile: %w", err)
	}
	r := newResolver()
	samples := make([]Sample, 0, len(raw.Rows))
	for _, row := range raw.Rows {
		th := r.thread(row.Thread)
		samples = append(samples, Sample{
			TimeNS:       r.scalar(r.times, row.SampleTime),
			Weight:       r.scalar(r.weights, row.CycleWeight),
			ThreadName:   th.Fmt,
			IsMainThread: strings.Contains(th.Fmt, "Main Thread"),
			Frames:       r.backtrace(row.Backtrace),
		})
	}
	return samples, nil
}
