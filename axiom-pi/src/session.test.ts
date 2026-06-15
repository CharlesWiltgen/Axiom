import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  formatDate,
  iosGroundTruth,
  findOnPath,
  toolContextBlock,
  buildAxiomContext,
  isAppleProject,
  resolveContextDecision,
} from "./session.ts";

describe("formatDate", () => {
  it("stamps weekday and ISO date in local time", () => {
    expect(formatDate(new Date(2026, 5, 14))).toBe("Sunday, 2026-06-14");
  });
});

describe("iosGroundTruth", () => {
  it("states the iOS 26 ground truth and no-denial rule, stamped with the date", () => {
    const text = iosGroundTruth(new Date(2026, 5, 14));
    expect(text).toContain("iOS 26 is the current major line");
    expect(text).toContain('NEVER claim an iOS/Xcode version "doesn\'t exist"');
    expect(text).toContain("Sunday, 2026-06-14");
  });
});

describe("findOnPath", () => {
  const env: NodeJS.ProcessEnv = { PATH: ["/a", "/b"].join(path.delimiter) };

  it("returns the first PATH dir that contains the binary", () => {
    const found = findOnPath("tool", env, (p) => p === path.join("/b", "tool"));
    expect(found).toBe(path.join("/b", "tool"));
  });

  it("returns null when the binary is on no PATH dir", () => {
    expect(findOnPath("tool", env, () => false)).toBeNull();
  });
});

describe("toolContextBlock", () => {
  it("is empty when no tools are available", () => {
    expect(toolContextBlock([])).toBe("");
  });

  it("lists available tools with their resolved paths", () => {
    const block = toolContextBlock([{ name: "xcsym", blurb: "crash", resolvedPath: "/usr/local/bin/xcsym" }]);
    expect(block).toContain("xcsym");
    expect(block).toContain("/usr/local/bin/xcsym");
  });
});

describe("buildAxiomContext", () => {
  it("wraps ground truth and available tools in the importance marker", () => {
    const ctx = buildAxiomContext({
      now: new Date(2026, 5, 14),
      availableTools: [{ name: "xclog", blurb: "console", resolvedPath: "/bin/xclog" }],
    });
    expect(ctx).toContain("<EXTREMELY_IMPORTANT>");
    expect(ctx).toContain("iOS 26 is the current major line");
    expect(ctx).toContain("/bin/xclog");
  });
});

describe("isAppleProject / resolveContextDecision", () => {
  it("detects a directory containing an Xcode project", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-apple-"));
    try {
      fs.mkdirSync(path.join(dir, "App.xcodeproj"));
      expect(isAppleProject(dir)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns false for a marker-free git repo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-plain-"));
    try {
      fs.writeFileSync(path.join(dir, ".git"), ""); // stops the upward walk at this dir
      fs.writeFileSync(path.join(dir, "notes.txt"), "hi");
      expect(isAppleProject(dir)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("honors the AXIOM_SESSION_CONTEXT override without scanning", () => {
    expect(resolveContextDecision("/nonexistent", "never")).toBe(false);
    expect(resolveContextDecision("/nonexistent", "always")).toBe(true);
  });
});
