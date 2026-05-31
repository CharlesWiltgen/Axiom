package main

import "encoding/json"

// Frame is the numeric rect AXe emits alongside the string AXFrame.
type Frame struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// AXElement mirrors one node of `axe describe-ui` output. Fields that AXe
// emits as JSON null are pointers so absence is distinguishable from "".
type AXElement struct {
	AXUniqueID      *string     `json:"AXUniqueId"`
	AXLabel         *string     `json:"AXLabel"`
	AXValue         *string     `json:"AXValue"`
	Title           *string     `json:"title"`
	Help            *string     `json:"help"`
	Subrole         *string     `json:"subrole"`
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
		if el.AXUniqueID != nil && *el.AXUniqueID == id {
			out = append(out, el)
		}
	})
	return out
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
