import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
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

  it("does not treat a marker in the system temp root as project evidence", () => {
    // Axiom-3k2i: $TMPDIR is long-lived and collects other programs' scratch
    // files. One stray `plan-test.swift` at its top level made EVERY cwd beneath
    // it read as an Apple project — same class as GH #52's ~/.swiftpm.
    const root = os.tmpdir();
    const probe = path.join(root, `axiom-detect-probe-${process.pid}.swift`);
    fs.writeFileSync(probe, "");
    try {
      const work = fs.mkdtempSync(path.join(root, "axiom-temp-plain-"));
      try {
        expect(isAppleProject(work)).toBe(false);
      } finally {
        fs.rmSync(work, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(probe, { force: true });
    }
  });

  it("does not treat the temp root itself as a project", () => {
    expect(isAppleProject(os.tmpdir())).toBe(false);
  });

  it("still detects an Apple project inside the temp root", () => {
    // Over-correction guard: only the temp ROOT is neutralized.
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-temp-project-"));
    try {
      fs.writeFileSync(path.join(project, "Package.swift"), "");
      expect(isAppleProject(project)).toBe(true);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
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

// --- Parity with the canonical Python detector ------------------------------
// project_detect.py is the source of truth; session.ts is a hand-maintained port,
// and the two have drifted once already (Axiom-3k2i's temp-root fix first shipped
// in Python only). This gate runs BOTH implementations over one fixture matrix and
// fails on any verdict mismatch. It rides the axiom-pi suite (`npm test` in
// axiom-pi), which step 17 of the full pre-deploy runs.

describe("project detection parity with project_detect.py", () => {
  const HOOKS_DIR = path.resolve(
    import.meta.dirname!,
    "..",
    "..",
    ".claude-plugin",
    "plugins",
    "axiom",
    "hooks",
  );

  type Case = { name: string; cwd: string; home: string | null };

  /** Verdicts from the shipped Python detector — one subprocess for the matrix. */
  function pythonVerdicts(cases: readonly Case[]): boolean[] {
    const script = [
      "import json, os, sys",
      `sys.path.insert(0, ${JSON.stringify(HOOKS_DIR)})`,
      "import project_detect",
      "out = []",
      "for case in json.load(sys.stdin):",
      "    if case['home']:",
      "        os.environ['HOME'] = case['home']",
      "    else:",
      "        os.environ.pop('HOME', None)",
      "    out.append(project_detect.is_apple_project(case['cwd']))",
      "print(json.dumps(out))",
    ].join("\n");
    try {
      const stdout = execFileSync("python3", ["-c", script], {
        input: JSON.stringify(cases),
        encoding: "utf8",
        cwd: os.tmpdir(),
      });
      return JSON.parse(stdout) as boolean[];
    } catch (error) {
      throw new Error(
        `parity gate needs python3 and the canonical detector: ${(error as Error).message}`,
      );
    }
  }

  /** The same verdicts from this module, with each case's HOME applied. */
  function tsVerdicts(cases: readonly Case[]): boolean[] {
    const prior = process.env.HOME;
    try {
      return cases.map((entry) => {
        if (entry.home === null) delete process.env.HOME;
        else process.env.HOME = entry.home;
        return isAppleProject(entry.cwd);
      });
    } finally {
      if (prior === undefined) delete process.env.HOME;
      else process.env.HOME = prior;
    }
  }

  function expectParity(cases: readonly Case[], expected: boolean[]): void {
    const mine = tsVerdicts(cases);
    const label = cases.map((entry) => entry.name).join(" | ");
    expect(mine, label).toEqual(pythonVerdicts(cases));
    expect(mine, label).toEqual(expected);
  }

  it("agrees with the Python detector on every fixture", () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-parity-"));
    const dir = (...parts: string[]): string => {
      const made = path.join(scratch, ...parts);
      fs.mkdirSync(made, { recursive: true });
      return made;
    };
    const file = (...parts: string[]): void => {
      const made = path.join(scratch, ...parts);
      fs.mkdirSync(path.dirname(made), { recursive: true });
      fs.writeFileSync(made, "");
    };
    const tempProject = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-parity-project-"));
    fs.writeFileSync(path.join(tempProject, "Package.swift"), "");
    const tempPlain = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-parity-plain-"));
    const tempProbe = path.join(os.tmpdir(), `axiom-parity-probe-${process.pid}.swift`);
    fs.writeFileSync(tempProbe, "");

    try {
      const plain = dir("plain");
      const atCwd = dir("marker-at-cwd");
      file("marker-at-cwd", "Package.swift");
      const ancestor = dir("ancestor", "sub");
      file("ancestor", "App.xcodeproj", "keep");
      const gitRepo = dir("git-repo");
      fs.mkdirSync(path.join(gitRepo, ".git"));
      const repoInside = dir("above-root", "repo", "inside");
      fs.mkdirSync(path.join(scratch, "above-root", "repo", ".git"));
      file("above-root", "Above.swift");
      const home = dir("home");
      fs.mkdirSync(path.join(home, ".swiftpm"));
      const underHome = dir("home", "scratch", "pyproj");
      const playgrounds = dir("playgrounds");
      fs.mkdirSync(path.join(playgrounds, "MyApp.swiftpm"));

      expectParity(
        [
          { name: "plain dir", cwd: plain, home: null },
          { name: "marker at cwd", cwd: atCwd, home: null },
          { name: "marker in ancestor", cwd: ancestor, home: null },
          { name: "marker-free git repo", cwd: gitRepo, home: null },
          { name: "marker above the git root", cwd: repoInside, home: null },
          { name: "non-git dir under a .swiftpm home", cwd: underHome, home },
          { name: "visible .swiftpm package", cwd: playgrounds, home: null },
          { name: "project inside the temp root", cwd: tempProject, home: null },
          { name: "plain temp dir under a polluted temp root", cwd: tempPlain, home: null },
          { name: "the temp root itself", cwd: os.tmpdir(), home: null },
          { name: "missing path (fail-open)", cwd: path.join(scratch, "nope"), home: null },
        ],
        [false, true, true, false, false, false, true, true, false, false, true],
      );
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
      fs.rmSync(tempProject, { recursive: true, force: true });
      fs.rmSync(tempPlain, { recursive: true, force: true });
      fs.rmSync(tempProbe, { force: true });
    }
  });

  it("fails open identically on an oversized tree (GH #45)", () => {
    const big = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-parity-big-"));
    try {
      for (let i = 0; i < 10_050; i++) fs.writeFileSync(path.join(big, `f${i}`), "");
      expectParity([{ name: "oversized tree", cwd: big, home: null }], [true]);
    } finally {
      fs.rmSync(big, { recursive: true, force: true });
    }
  }, 30_000);
});
