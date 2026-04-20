package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

// rawUsedImage matches the shape of entries in an .ips `usedImages` array.
// Apple's schema uses different casings over time; the json tags line up with
// what both v1 and v2 payloads actually emit.
type rawUsedImage struct {
	UUID string          `json:"uuid"`
	Name string          `json:"name"`
	Path string          `json:"path"`
	Arch string          `json:"arch"`
	Base json.RawMessage `json:"base"`
	Size json.RawMessage `json:"size"`
}

// ParseUsedImages extracts UsedImages from an .ips file (v1 or v2) without
// doing any thread/frame parsing. This is the minimum needed for `xcsym
// verify`. Full crash parsing lands in Phase 5.
//
// format must be one of the detected format constants; for FormatIPSv2 we
// skip the first-line header and parse the second line. MetricKit is not
// supported here — it stores images under callStackTree and needs the full
// Phase-5 parser.
func ParseUsedImages(data []byte, format string) ([]UsedImage, error) {
	switch format {
	case FormatIPSv1:
		return parseUsedImagesJSON(data)
	case FormatIPSv2:
		idx := bytes.IndexByte(data, '\n')
		if idx <= 0 {
			return nil, fmt.Errorf("ips_json_v2: missing newline between header and payload")
		}
		return parseUsedImagesJSON(bytes.TrimSpace(data[idx+1:]))
	case FormatMetricKit:
		return nil, fmt.Errorf("MetricKit verify not yet supported (Phase 5)")
	case FormatAppleCrash:
		// Run the full .crash parser and lift its UsedImages. This is a
		// little heavier than the JSON-only fast path (we also parse
		// threads and header fields) but keeps image extraction in one
		// place — the alternative is maintaining a second Binary Images
		// scanner that has to stay in sync with the parser.
		raw, err := ParseAppleCrash(data)
		if err != nil {
			return nil, fmt.Errorf("apple_crash verify: %w", err)
		}
		return raw.UsedImages, nil
	default:
		return nil, fmt.Errorf("unsupported format for verify: %s", format)
	}
}

func parseUsedImagesJSON(payload []byte) ([]UsedImage, error) {
	var envelope struct {
		UsedImages []rawUsedImage `json:"usedImages"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return nil, fmt.Errorf("parse usedImages: %w", err)
	}
	out := make([]UsedImage, 0, len(envelope.UsedImages))
	for _, raw := range envelope.UsedImages {
		if raw.UUID == "" {
			continue
		}
		out = append(out, UsedImage{
			UUID: NormalizeUUID(strings.TrimSpace(raw.UUID)),
			Name: raw.Name,
			Path: raw.Path,
			Arch: raw.Arch,
		})
	}
	return out, nil
}
