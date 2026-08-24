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
  isVacuousScanRoot,
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

  // --- GH #52 -------------------------------------------------------------
  // Two defects, ported from project_detect_test.py. Keep the two suites in
  // step: this file is a port of project_detect.py and drifts silently.

  /** Build a throwaway tree, run `fn` with HOME pointed at it, always clean up. */
  const withHome = (fn: (home: string) => void): void => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-home-"));
    const prior = process.env.HOME;
    try {
      process.env.HOME = home;
      fn(home);
    } finally {
      if (prior === undefined) delete process.env.HOME;
      else process.env.HOME = prior;
      fs.rmSync(home, { recursive: true, force: true });
    }
  };

  it("does not treat SwiftPM's ~/.swiftpm tool dir as a project marker", () => {
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".swiftpm"));
      expect(isAppleProject(home)).toBe(false);
    });
  });

  it("still treats a visible .swiftpm package as a marker", () => {
    withHome((home) => {
      const proj = path.join(home, "Projects", "MyApp.swiftpm");
      fs.mkdirSync(proj, { recursive: true });
      expect(isAppleProject(path.dirname(proj))).toBe(true);
    });
  });

  it("does not inherit the ~/.swiftpm false positive in a non-git dir under home", () => {
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".swiftpm"));
      const opened = path.join(home, "scratch", "pyproj");
      fs.mkdirSync(opened, { recursive: true });
      fs.writeFileSync(path.join(opened, "main.py"), "");
      expect(isAppleProject(opened)).toBe(false);
    });
  });

  it("does not descend into hidden dirs (the ~/.swiftpm cache holds real packages)", () => {
    withHome((home) => {
      // Scan root must NOT be home: the home guard returns before the descent
      // code runs, so asserting on home tests nothing. (It didn't — removing the
      // descent guard left this suite fully green until mutation testing caught it.)
      const work = path.join(home, "work");
      const cached = path.join(work, ".swiftpm", "cache", "repos", "Pkg");
      fs.mkdirSync(cached, { recursive: true });
      fs.writeFileSync(path.join(cached, "Package.swift"), "");
      expect(isAppleProject(work)).toBe(false);
    });
  });

  it("treats the filesystem root and its children as vacuous scan roots", () => {
    // GH #52 generalized: `/` used to trigger a 51-second containment scan in a
    // hook that runs on every prompt. Asserted through the real entry point.
    expect(isAppleProject("/")).toBe(false);
    expect(isAppleProject("/Volumes")).toBe(false);
  });

  // Mirrors TestIsVacuousScanRoot in project_detect_test.py. Tested directly
  // because a genuinely shallow path (/app) cannot be built under a temp dir, so
  // an end-to-end test silently never reaches the depth rule at all.
  describe("isVacuousScanRoot", () => {
    const HOME = "/Users/someone";

    it("treats the filesystem root and its children as vacuous", () => {
      for (const dir of ["/", "/Users", "/tmp", "/Volumes", "/home"]) {
        expect(isVacuousScanRoot(dir, HOME, false)).toBe(true);
      }
    });

    it("treats home as vacuous, even when home is a repo root", () => {
      expect(isVacuousScanRoot(HOME, HOME, false)).toBe(true);
      expect(isVacuousScanRoot(HOME, HOME, true)).toBe(true);
    });

    it("keeps the filesystem root vacuous even as a repo root", () => {
      expect(isVacuousScanRoot("/", HOME, true)).toBe(true);
    });

    it("lets a repo boundary override the depth rule", () => {
      for (const dir of ["/app", "/workspace", "/src"]) {
        expect(isVacuousScanRoot(dir, HOME, true)).toBe(false);
        expect(isVacuousScanRoot(dir, HOME, false)).toBe(true);
      }
    });

    it("leaves ordinary project paths alone", () => {
      for (const dir of ["/Users/someone/Projects/App", "/Volumes/Ext/Code/App", "/opt/src/App"]) {
        expect(isVacuousScanRoot(dir, HOME, false)).toBe(false);
      }
    });

    it("still gates the filesystem top when HOME is unset", () => {
      expect(isVacuousScanRoot("/", null, false)).toBe(true);
      expect(isVacuousScanRoot("/Users/someone/App", null, false)).toBe(false);
    });
  });

  it("does not let a git-managed HOME hijack a nested project", () => {
    // REGRESSION (found in final review): a .git at $HOME used to widen the scan
    // root to home, which the vacuous check then refused — silently disabling
    // Axiom for every project under a dotfiles-repo home with nested markers.
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".git"));
      const app = path.join(home, "Projects", "App");
      fs.mkdirSync(path.join(app, "ios", "App.xcodeproj"), { recursive: true });
      expect(isAppleProject(app)).toBe(true);
    });
  });

  it("scans the branch of a git-managed HOME when opened deep", () => {
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".git"));
      const app = path.join(home, "Projects", "App");
      fs.mkdirSync(path.join(app, "ios", "App.xcodeproj"), { recursive: true });
      const opened = path.join(app, "Sources", "Feature", "Sub");
      fs.mkdirSync(opened, { recursive: true });
      expect(isAppleProject(opened)).toBe(true);
    });
  });

  it("does not scan all of a git-managed HOME", () => {
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".git"));
      fs.mkdirSync(path.join(home, "Projects", "App"), { recursive: true });
      fs.writeFileSync(path.join(home, "Projects", "App", "Package.swift"), "");
      const opened = path.join(home, "scratch", "pyproj");
      fs.mkdirSync(opened, { recursive: true });
      expect(isAppleProject(opened)).toBe(false);
    });
  });

  it("is a known false negative when HOME is itself a repo root (documented limit)", () => {
    // Refusing containment at $HOME cannot be told apart from the dotfiles-repo
    // case this fix exists for — both are a .git hit at home. The dotfiles case is
    // the one GH #52 reported, so it wins; devcontainers that set HOME=/workspace
    // with markers only in subdirs need AXIOM_SESSION_CONTEXT=always. Change this
    // assertion only with a signal that actually separates the two.
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".git"));
      const nested = path.join(home, "ios", "App.xcodeproj");
      fs.mkdirSync(nested, { recursive: true });
      expect(isAppleProject(home)).toBe(false);
    });
  });

  it("refuses containment for a home directory", () => {
    withHome((home) => {
      const proj = path.join(home, "Projects", "App");
      fs.mkdirSync(proj, { recursive: true });
      fs.writeFileSync(path.join(proj, "Package.swift"), "");
      expect(isAppleProject(home)).toBe(false);
    });
  });

  it("refuses containment when home is its own git root (dotfiles repo)", () => {
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".git"));
      const proj = path.join(home, "Projects", "App");
      fs.mkdirSync(proj, { recursive: true });
      fs.writeFileSync(path.join(proj, "Package.swift"), "");
      expect(isAppleProject(home)).toBe(false);
    });
  });

  it("still injects for a DIRECT marker at home", () => {
    withHome((home) => {
      fs.mkdirSync(path.join(home, "App.xcodeproj"));
      expect(isAppleProject(home)).toBe(true);
    });
  });

  it("still detects a real Apple project living under home", () => {
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".swiftpm"));
      const proj = path.join(home, "Projects", "App");
      fs.mkdirSync(proj, { recursive: true });
      fs.writeFileSync(path.join(proj, "Package.swift"), "");
      expect(isAppleProject(proj)).toBe(true);
    });
  });

  it("still applies containment below home", () => {
    withHome((home) => {
      fs.mkdirSync(path.join(home, ".swiftpm"));
      const nested = path.join(home, "work", "ios", "App.xcodeproj");
      fs.mkdirSync(nested, { recursive: true });
      expect(isAppleProject(path.join(home, "work"))).toBe(true);
    });
  });

  it("honors the AXIOM_SESSION_CONTEXT override without scanning", () => {
    expect(resolveContextDecision("/nonexistent", "never")).toBe(false);
    expect(resolveContextDecision("/nonexistent", "always")).toBe(true);
  });
});
