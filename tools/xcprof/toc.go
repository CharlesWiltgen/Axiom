package main

import (
	"encoding/xml"
	"fmt"
)

// --- raw XML mirror of `xctrace export --toc` (verified against a real trace) ---

type tocXML struct {
	XMLName xml.Name `xml:"trace-toc"`
	Runs    []tocRun `xml:"run"`
}

type tocRun struct {
	Number    int          `xml:"number,attr"`
	Device    tocDevice    `xml:"info>target>device"`
	Target    tocProcess   `xml:"info>target>process"`
	Summary   tocSummary   `xml:"info>summary"`
	Processes []tocProcess `xml:"processes>process"`
	Tables    []tocTable   `xml:"data>table"`
}

type tocDevice struct {
	Platform  string `xml:"platform,attr"`
	Model     string `xml:"model,attr"`
	Name      string `xml:"name,attr"`
	OSVersion string `xml:"os-version,attr"`
	UUID      string `xml:"uuid,attr"`
}

type tocProcess struct {
	Type string `xml:"type,attr"`
	Name string `xml:"name,attr"`
	PID  int    `xml:"pid,attr"`
	Path string `xml:"path,attr"`
}

type tocSummary struct {
	Duration           float64 `xml:"duration"`
	EndReason          string  `xml:"end-reason"`
	InstrumentsVersion string  `xml:"instruments-version"`
	TemplateName       string  `xml:"template-name"`
	RecordingMode      string  `xml:"recording-mode"`
	TimeLimit          string  `xml:"time-limit"`
}

type tocTable struct {
	Schema string `xml:"schema,attr"`
}

// --- public model ---

// TOC is the parsed table-of-contents for a single trace run.
type TOC struct {
	RunNumber          int
	Device             tocDevice
	Target             tocProcess
	DurationSec        float64
	EndReason          string
	InstrumentsVersion string
	TemplateName       string
	RecordingMode      string
	TimeLimit          string
	Processes          []tocProcess
	Schemas            []string // unique schemas present, in first-seen order
}

func parseTOC(data []byte) (*TOC, error) {
	var raw tocXML
	if err := xml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse trace toc: %w", err)
	}
	if len(raw.Runs) == 0 {
		return nil, fmt.Errorf("trace toc has no runs")
	}
	run := raw.Runs[0]
	for _, r := range raw.Runs {
		if r.Number == 1 {
			run = r
			break
		}
	}
	toc := &TOC{
		RunNumber:          run.Number,
		Device:             run.Device,
		Target:             run.Target,
		DurationSec:        run.Summary.Duration,
		EndReason:          run.Summary.EndReason,
		InstrumentsVersion: run.Summary.InstrumentsVersion,
		TemplateName:       run.Summary.TemplateName,
		RecordingMode:      run.Summary.RecordingMode,
		TimeLimit:          run.Summary.TimeLimit,
		Processes:          run.Processes,
	}
	seen := map[string]bool{}
	for _, t := range run.Tables {
		if t.Schema == "" || seen[t.Schema] {
			continue
		}
		seen[t.Schema] = true
		toc.Schemas = append(toc.Schemas, t.Schema)
	}
	return toc, nil
}

func (t *TOC) hasSchema(schema string) bool {
	for _, s := range t.Schemas {
		if s == schema {
			return true
		}
	}
	return false
}
