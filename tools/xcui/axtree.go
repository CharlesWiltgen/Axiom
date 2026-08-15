package main

import "encoding/json"

// Frame is the numeric rect AXe emits alongside the string AXFrame.
type Frame struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// AXText is a string field that also accepts the numbers and booleans AXe emits.
//
// AXValue is not consistently a string: a slider reports 0.5, a page control an
// integer, a toggle a bool. Typing it as *string made encoding/json fail the
// WHOLE document — "cannot unmarshal number into Go struct field
// AXElement.AXValue of type string" — so a single numeric value anywhere on
// screen broke every command that reads the tree: assert, wait, dialog,
// voiceover. Measured on a stock Settings screen: 258 null, 10 string, 5 number.
//
// Applied to every text-ish field, not just AXValue. The cost of being wrong
// about one field's type is total parse failure, and there is no upside to
// being strict here — xcui compares these as text either way.
type AXText string

func (a *AXText) UnmarshalJSON(b []byte) error {
	if len(b) == 0 || string(b) == "null" {
		return nil
	}
	if b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		*a = AXText(s)
		return nil
	}
	// Number, bool, or anything else scalar: keep the literal JSON text, which is
	// what a user comparing against `--value 0.5` or `--value true` would type.
	*a = AXText(b)
	return nil
}

// AXElement mirrors one node of `axe describe-ui` output. Fields that AXe
// emits as JSON null are pointers so absence is distinguishable from "".
type AXElement struct {
	AXUniqueID      *AXText     `json:"AXUniqueId"`
	AXLabel         *AXText     `json:"AXLabel"`
	AXValue         *AXText     `json:"AXValue"`
	Title           *AXText     `json:"title"`
	Help            *AXText     `json:"help"`
	Subrole         *AXText     `json:"subrole"`
	Role            string      `json:"role"`
	RoleDescription string      `json:"role_description"`
	Type            string      `json:"type"`
	AXFrame         string      `json:"AXFrame"`
	Frame           Frame       `json:"frame"`
	Enabled         bool        `json:"enabled"`
	PID             int         `json:"pid"`
	Children        []AXElement `json:"children"`
}

func parseDescribeUI(data []byte) ([]AXElement, error) {
	var roots []AXElement
	if err := json.Unmarshal(data, &roots); err != nil {
		return nil, err
	}
	return roots, nil
}

// walk visits every element depth-first, roots first.
func walk(roots []AXElement, visit func(AXElement)) {
	for _, el := range roots {
		visit(el)
		walk(el.Children, visit)
	}
}

// findByID returns every element whose AXUniqueId equals id. More than one
// match means the identifier isn't unique (the --single assertion catches it).
func findByID(roots []AXElement, id string) []AXElement {
	var out []AXElement
	walk(roots, func(el AXElement) {
		if el.AXUniqueID != nil && deref(el.AXUniqueID) == id {
			out = append(out, el)
		}
	})
	return out
}

func deref(s *AXText) string {
	if s == nil {
		return ""
	}
	return string(*s)
}
