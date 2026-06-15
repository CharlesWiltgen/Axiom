import { describe, it, expect } from "vitest";
import { AXIOM_COMMANDS, AUDIT_AREAS } from "./commands.ts";

describe("AXIOM_COMMANDS", () => {
  it("registers exactly the 15 Axiom commands, in order", () => {
    expect(AXIOM_COMMANDS.map((c) => c.name)).toEqual([
      "axiom-fix-build", "axiom-audit", "axiom-health-check", "axiom-analyze-crash",
      "axiom-triage", "axiom-console", "axiom-ui", "axiom-profile",
      "axiom-compare-traces", "axiom-optimize-build", "axiom-run-tests",
      "axiom-test-simulator", "axiom-screenshot", "axiom-status", "axiom-ask",
    ]);
  });

  it("gives every command a non-empty prompt for both empty and non-empty args", () => {
    for (const cmd of AXIOM_COMMANDS) {
      expect(cmd.prompt("").length).toBeGreaterThan(0);
      expect(cmd.prompt("Foo.swift").length).toBeGreaterThan(0);
    }
  });
});

describe("axiom-audit prompt", () => {
  const audit = AXIOM_COMMANDS.find((c) => c.name === "axiom-audit")!;

  it("names the area when one is given", () => {
    expect(audit.prompt("memory")).toContain("memory");
  });

  it("routes 'all' to a full health check", () => {
    expect(audit.prompt("all")).toContain("health check");
  });

  it("suggests audits when no area is given", () => {
    expect(audit.prompt("")).toContain("which Axiom audits");
  });

  it("offers the audit areas as completions", () => {
    expect(audit.completions).toBe(AUDIT_AREAS);
  });
});

describe("axiom-analyze-crash prompt", () => {
  it("includes the crash file path argument", () => {
    const cmd = AXIOM_COMMANDS.find((c) => c.name === "axiom-analyze-crash")!;
    expect(cmd.prompt("/tmp/foo.ips")).toContain("/tmp/foo.ips");
  });
});
