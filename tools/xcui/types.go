package main

// DoctorReport is the JSON payload of `xcui doctor`.
type DoctorReport struct {
	Tool       string   `json:"tool"`
	Version    string   `json:"version"`
	AxePath    string   `json:"axe_path,omitempty"`
	AxeVersion string   `json:"axe_version,omitempty"`
	BrewPath   string   `json:"brew_path,omitempty"`
	XcodePath  string   `json:"xcode_path,omitempty"`
	BootedUDID string   `json:"booted_udid,omitempty"`
	Installed  bool     `json:"installed,omitempty"` // true if --install ran brew
	OK         bool     `json:"ok"`
	Problems   []string `json:"problems,omitempty"`
	NextSteps  []string `json:"next_steps,omitempty"`
}
