package main

// DoctorReport is the JSON payload of `xcui doctor`.
type DoctorReport struct {
	Tool       string `json:"tool"`
	Version    string `json:"version"`
	AxePath    string `json:"axe_path,omitempty"`
	AxeVersion string `json:"axe_version,omitempty"`
	BrewPath   string `json:"brew_path,omitempty"`
	XcodePath  string `json:"xcode_path,omitempty"`
	// AxeDeveloperDir is the DEVELOPER_DIR xcui injects for AXe when the selected
	// Xcode relocated SimulatorKit.framework (Xcode 27 beta). Empty when unneeded.
	AxeDeveloperDir string   `json:"axe_developer_dir,omitempty"`
	BootedUDID      string   `json:"booted_udid,omitempty"`
	Installed       bool     `json:"installed,omitempty"` // true if --install ran brew
	OK              bool     `json:"ok"`
	Note            string   `json:"note,omitempty"` // advisory (e.g. >1 sim booted); does not flip OK
	Problems        []string `json:"problems,omitempty"`
	NextSteps       []string `json:"next_steps,omitempty"`
}

// WaitReport is the JSON payload of `xcui wait`.
type WaitReport struct {
	Tool      string `json:"tool"`
	Version   string `json:"version"`
	Condition string `json:"condition"`
	Target    string `json:"target,omitempty"`
	Met       bool   `json:"met"`
	WaitedMS  int64  `json:"waited_ms"`
	Polls     int    `json:"polls"`
}

// AssertReport is the JSON payload of `xcui assert`.
type AssertReport struct {
	Tool     string   `json:"tool"`
	Version  string   `json:"version"`
	ID       string   `json:"id"`
	Matched  int      `json:"matched"`
	Pass     bool     `json:"pass"`
	Failures []string `json:"failures,omitempty"`
}

// A11yReport is the JSON payload of `xcui a11y set` / `a11y reset`.
type A11yReport struct {
	Tool       string `json:"tool"`
	Version    string `json:"version"`
	Toggle     string `json:"toggle,omitempty"`
	Value      string `json:"value,omitempty"`
	Applied    bool   `json:"applied"`
	Relaunched bool   `json:"relaunched,omitempty"`
	Note       string `json:"note,omitempty"`
}

// DialogReport is the JSON payload of `xcui dialog accept|dismiss|pregrant`.
type DialogReport struct {
	Tool    string   `json:"tool"`
	Version string   `json:"version"`
	Action  string   `json:"action"`
	Handled bool     `json:"handled"`
	Button  string   `json:"button,omitempty"`  // tapped button label (accept/dismiss)
	Bundle  string   `json:"bundle,omitempty"`  // target bundle id (pregrant)
	Granted []string `json:"granted,omitempty"` // services granted (pregrant)
	Note    string   `json:"note,omitempty"`
}

// VoiceOverReport is the JSON payload of `xcui voiceover traverse|assert`.
type VoiceOverReport struct {
	Tool     string   `json:"tool"`
	Version  string   `json:"version"`
	Action   string   `json:"action"`
	Count    int      `json:"count"`
	Sequence []string `json:"sequence,omitempty"`
	Pass     bool     `json:"pass,omitempty"`
	Failures []string `json:"failures,omitempty"`
}
