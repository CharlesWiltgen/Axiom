/**
 * Tests for scripts/shared-sections.ts.
 *
 * Run via `node --test scripts/shared-sections.test.ts`; `npm run test:unit` runs
 * it with every other script test. The pure-function suites use synthetic
 * markdown. The last suite reads the real plugin, so CI fails on drift even
 * where pre-deploy does not run.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GENERATED_PREFIX } from "./inline-auditors.ts";
import {
  checkSharedSections,
  endMarkerFor,
  findSection,
  MIN_SHARED_PARAGRAPH,
  readCommittedVersions,
  replaceSection,
  type SharedSection,
  sharedSectionErrors,
  syncSharedSections,
} from "./shared-sections.ts";

const HEADING = "Capture Build and Test Diagnostics";
const TITLE = `"## ${HEADING}"`;
const SPEC: SharedSection = {
  heading: HEADING,
  source: "skills/suite/SKILL.md",
  targets: ["skills/suite/skills/child.md", "agents/fixer.md"],
};
const END = endMarkerFor(SPEC);
const LONG =
  "Inspect `command` (native outcome) and `collection` (evidence completeness) separately. " +
  "Native success can accompany partial collection, so read the omissions list and the saved " +
  "report before rebuilding anything to redisplay output.";
const SECTION = [
  `## ${HEADING}`,
  "",
  "Resolve the helper first.",
  "",
  LONG,
  "",
  "```bash",
  '"$AXBUILD" xcodebuild build',
  "```",
  "",
  END,
].join("\n");
const BEFORE = "# Title\n\nIntro.\n\n";
const AFTER = "\n\n## Next Section\n\nMore.\n";
const doc = (section: string) => BEFORE + section + AFTER;
const source = () => doc(SECTION);
const stale = (section: string) => section.replace("Resolve the helper first.", "Hand-edited.");
const sliceOf = (markdown: string) => {
  const found = findSection(markdown, HEADING, END);
  return found.kind === "found"
    ? markdown.split("\n").slice(found.start, found.end).join("\n")
    : found;
};
const DRIFT =
  `differs from ${SPEC.source} — edit ${SPEC.source}, not this copy, then run \`npm run build:shared\` (it overwrites the copy)`;
const ORPHAN =
  `is not registered in SHARED_SECTIONS — register it as a target (it needs the heading and end marker), or replace the copied text with a pointer to ${SPEC.source}`;

// The bash block lost its closing fence. A later ```bash line is not a valid closer,
// so the fence is still open when the end marker arrives.
const UNCLOSED = [
  "# Title", //                       1
  "", //                              2
  "Intro.", //                        3
  "", //                              4
  `## ${HEADING}`, //                 5
  "", //                              6
  "Resolve the helper first.", //     7
  "", //                              8
  "```bash", //                       9
  '"$AXBUILD" xcodebuild build', //  10
  "", //                             11
  "```bash", //                      12
  "echo hi", //                      13
  "```", //                          14
  END, //                            15
  "",
].join("\n");
const UNCLOSED_PROBLEM =
  `${TITLE} opens a code fence at line 12 inside the fence opened at line 9 (missing closing fence?)`;

describe("findSection", () => {
  it("runs from the heading through its end marker", () => {
    assert.equal(sliceOf(doc(SECTION)), SECTION);
  });

  it("keeps headings of any level inside the section, so a demoted heading after it cannot extend it", () => {
    const section = [`## ${HEADING}`, "### Detail", "## Not an end", "# Nor this", "", END].join(
      "\n",
    );
    assert.equal(sliceOf(BEFORE + section + "\n\n### Demoted\n\nRouter text.\n"), section);
  });

  it("reports a section with no end marker", () => {
    assert.deepEqual(findSection(doc(SECTION.replace(END, "")), HEADING, END), {
      kind: "unterminated",
    });
  });

  it("matches the heading line exactly, allowing trailing spaces but not a longer heading", () => {
    const section = SECTION.replace("\n", "  \n");
    assert.equal(sliceOf(doc(`## ${HEADING} (old)\n\nText.\n\n${section}`)), section);
  });

  it("does not count a heading line inside a backtick or tilde fence as an occurrence", () => {
    for (const fence of ["```", "~~~"]) {
      assert.equal(
        sliceOf(doc(`${fence}markdown\n## ${HEADING}\n${fence}\n\n${SECTION}`)),
        SECTION,
      );
    }
  });

  it("reports a heading that appears twice as ambiguous", () => {
    assert.deepEqual(findSection(doc(SECTION) + "\n" + SECTION + "\n", HEADING, END), {
      kind: "ambiguous",
      count: 2,
    });
  });

  it("follows CommonMark fences: an indented or tilde line does not close a backtick fence", () => {
    const section = [
      `## ${HEADING}`,
      "```bash",
      "    ```",
      "~~~",
      "## a shell comment",
      "```",
      "````markdown",
      "```",
      "````",
      "```js``` at a line start is inline code, not a fence",
      "",
      END,
    ].join("\n");
    assert.deepEqual(findSection(doc(section), HEADING, END), {
      kind: "found",
      start: 4,
      end: 16,
    });
  });
});

describe("replaceSection", () => {
  it("replaces only the section, keeping the text before and after it", () => {
    const replacement = `## ${HEADING}\n\nNew body.\n\n${END}`;
    assert.equal(replaceSection(doc(SECTION), HEADING, END, replacement), doc(replacement));
  });
});

describe("sharedSectionErrors", () => {
  const source = doc(SECTION);

  it("returns no errors when every target section matches the source", () => {
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: "Other intro.\n\n" + SECTION + "\n",
      [SPEC.targets[1]]: doc(SECTION),
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files), []);
  });

  it("names each broken target, the reason and the fix", () => {
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(stale(SECTION)),
      // targets[1] is absent: a registered target was deleted or renamed
      "skills/other/skills/stray.md": doc(SECTION),
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files), [
      `${SPEC.targets[0]}: ${TITLE} ${DRIFT}`,
      `${SPEC.targets[1]}: file not found (registered in SHARED_SECTIONS)`,
      `skills/other/skills/stray.md: carries ${TITLE} or its text but ${ORPHAN}`,
    ]);
  });

  it("reports a target that lost its section, carries it twice, or lost its end marker", () => {
    const other: SharedSection = { ...SPEC, targets: [...SPEC.targets, "agents/third.md"] };
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(SECTION) + "\n" + SECTION + "\n",
      [SPEC.targets[1]]: "# Fixer\n\nNo section here.\n",
      "agents/third.md": doc(SECTION.replace(END, "")),
    };
    assert.deepEqual(sharedSectionErrors([other], files), [
      `${SPEC.targets[0]}: ${TITLE} appears 2 times`,
      `${
        SPEC.targets[1]
      }: ${TITLE} not found — add the heading and \`${END}\` where the copy belongs, then run \`npm run build:shared\`, or unregister the file`,
      `agents/third.md: ${TITLE} has no end marker; add \`${END}\` on its own line after the copy`,
    ]);
  });

  it("stops at the source when it has no section, two of them, no end marker, or a broken fence", () => {
    const targets = { [SPEC.targets[0]]: doc(SECTION), [SPEC.targets[1]]: doc(SECTION) };
    const cases: [string, string][] = [
      ["# Suite\n\nNothing shared.\n", `source section ${TITLE} not found`],
      [doc(SECTION) + "\n" + SECTION + "\n", `${TITLE} appears 2 times`],
      [
        doc(SECTION.replace(END, "")),
        `${TITLE} has no end marker; add \`${END}\` on its own line after the copy`,
      ],
      [UNCLOSED, UNCLOSED_PROBLEM],
      [
        doc(SECTION.replace("```\n\n", "\n\n")),
        `${TITLE} has a code fence opened at line 11 that is still open at the end marker`,
      ],
    ];
    for (const [content, problem] of cases) {
      assert.deepEqual(
        sharedSectionErrors([SPEC], { [SPEC.source]: content, ...targets }),
        [`${SPEC.source}: ${problem}`],
      );
    }
  });

  it("rejects CRLF line endings in a registered file", () => {
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(SECTION),
      [SPEC.targets[1]]: doc(SECTION).replaceAll("\n", "\r\n"),
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files), [
      `${SPEC.targets[1]}: CRLF line endings; shared sections need LF`,
    ]);
  });

  it("rejects a child-skill copy that MCP would use as the skill's description", () => {
    const placement =
      `${TITLE} comes before the skill's first paragraph, which MCP uses as the skill's description — move the section below that paragraph`;
    for (const before of ["", "**Core principle** check dependencies first.\n\n"]) {
      const files = {
        [SPEC.source]: source,
        [SPEC.targets[0]]: `# Child\n\n${before}${SECTION}\n\n## Overview\n\nCheck first.\n`,
        [SPEC.targets[1]]: doc(SECTION),
      };
      assert.deepEqual(sharedSectionErrors([SPEC], files), [`${SPEC.targets[0]}: ${placement}`]);
    }
  });

  it("flags the section's text pasted under another heading, even in another spec's file", () => {
    assert.ok(LONG.length >= MIN_SHARED_PARAGRAPH);
    const other: SharedSection = {
      heading: "Other Shared",
      source: "skills/other/SKILL.md",
      targets: ["agents/other.md"],
    };
    const otherSection = `## Other Shared\n\nTheir own text.\n\n${endMarkerFor(other)}`;
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(SECTION),
      [SPEC.targets[1]]: doc(SECTION),
      [other.source]: doc(otherSection),
      [other.targets[0]]: doc(otherSection) + `\n## Running Builds\n\n${LONG}\n`,
      "agents/loose.md": `# Loose\n\nIntro.\n\n## Running Builds\n\n${LONG}\n`,
    };
    assert.deepEqual(sharedSectionErrors([SPEC, other], files), [
      `agents/loose.md: carries ${TITLE} or its text but ${ORPHAN}`,
      `${other.targets[0]}: carries ${TITLE} or its text but ${ORPHAN}`,
    ]);
  });

  it("flags an unregistered file that carries the heading over different text", () => {
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(SECTION),
      [SPEC.targets[1]]: doc(SECTION),
      "agents/heading-only.md": doc(`## ${HEADING}\n\nA short note of its own.`),
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files), [
      `agents/heading-only.md: carries ${TITLE} or its text but ${ORPHAN}`,
    ]);
  });

  it("rejects two specs whose sections share a paragraph, since it would have two owners", () => {
    const other: SharedSection = {
      heading: "Other Shared",
      source: "skills/other/SKILL.md",
      targets: ["agents/other.md"],
    };
    const otherSection = `## Other Shared\n\n${LONG}\n\n${endMarkerFor(other)}`;
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(SECTION),
      [SPEC.targets[1]]: doc(SECTION),
      [other.source]: doc(otherSection),
      [other.targets[0]]: doc(otherSection),
    };
    assert.deepEqual(sharedSectionErrors([SPEC, other], files), [
      `${other.source}: "## Other Shared" repeats text from ${TITLE} (${SPEC.source}); give each paragraph one owning section`,
    ]);
  });

  it("flags a stray copy of the source's previous text when given the previous version", () => {
    const edited = SECTION.replace(LONG, LONG.replace("Native success", "A native success"));
    const files = {
      [SPEC.source]: doc(edited),
      [SPEC.targets[0]]: doc(edited),
      [SPEC.targets[1]]: doc(edited),
      "agents/loose.md": `# Loose\n\nIntro.\n\n${LONG}\n`,
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files), []);
    assert.deepEqual(sharedSectionErrors([SPEC], files, [{ [SPEC.source]: doc(SECTION) }]), [
      `agents/loose.md: carries ${TITLE} or its text but ${ORPHAN}`,
    ]);
  });

  it("reports only the fence problem for a copy with an end marker inside a fence", () => {
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(SECTION),
      [SPEC.targets[1]]: doc(
        [`## ${HEADING}`, "```markdown", END, "```", "", LONG, "", END].join("\n"),
      ),
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files), [
      `${
        SPEC.targets[1]
      }: ${TITLE} has a code fence opened at line 6 that is still open at the end marker`,
    ]);
  });

  it("leaves generated auditor sub-skills to their own gate, but only child skills", () => {
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(SECTION),
      [SPEC.targets[1]]: doc(SECTION),
      "skills/suite/skills/inlined.md": `${GENERATED_PREFIX}fixer.md -->\n${doc(SECTION)}`,
      "commands/scratch.md": `${GENERATED_PREFIX}fixer.md -->\n# Scratch\n\n${LONG}\n`,
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files), [
      `commands/scratch.md: carries ${TITLE} or its text but ${ORPHAN}`,
    ]);
  });

  it("rejects registry mistakes before checking any file", () => {
    const files = {
      [SPEC.source]: source,
      [SPEC.targets[0]]: doc(SECTION),
      [SPEC.targets[1]]: doc(SECTION),
    };
    const cases: [SharedSection[], string][] = [
      [
        [SPEC, { ...SPEC, source: "skills/x/SKILL.md" }],
        `SHARED_SECTIONS: ${TITLE} is registered 2 times`,
      ],
      [
        [{ ...SPEC, targets: [...SPEC.targets, SPEC.source] }],
        `SHARED_SECTIONS: ${SPEC.source} is a target of its own ${TITLE}`,
      ],
      [
        [{ ...SPEC, targets: [SPEC.targets[0], SPEC.targets[0]] }],
        `SHARED_SECTIONS: ${SPEC.targets[0]} is listed 2 times for ${TITLE}`,
      ],
      [[{ ...SPEC, targets: [] }], `SHARED_SECTIONS: ${TITLE} has no targets`],
    ];
    for (const [specs, error] of cases) {
      assert.deepEqual(sharedSectionErrors(specs, files), [error]);
      assert.deepEqual(syncSharedSections(specs, files), { files, changed: [], errors: [error] });
    }
  });
});

describe("syncSharedSections", () => {
  it("rewrites each stale target to the source section and leaves current targets alone", () => {
    const files = {
      [SPEC.source]: doc(SECTION),
      [SPEC.targets[0]]: doc(stale(SECTION)),
      [SPEC.targets[1]]: doc(SECTION),
    };
    assert.deepEqual(syncSharedSections([SPEC], files), {
      files: { ...files, [SPEC.targets[0]]: doc(SECTION) },
      changed: [SPEC.targets[0]],
      errors: [],
    });
  });

  it("copies only up to the end marker when the source's next heading is demoted", () => {
    const files = {
      [SPEC.source]: BEFORE + SECTION + "\n\n### When to Use\n\nRouter text.\n",
      [SPEC.targets[0]]: doc(stale(SECTION)),
      [SPEC.targets[1]]: doc(SECTION),
    };
    assert.equal(syncSharedSections([SPEC], files).files[SPEC.targets[0]], doc(SECTION));
  });

  it("changes nothing on a second run", () => {
    const files = {
      [SPEC.source]: doc(SECTION),
      [SPEC.targets[0]]: doc(stale(SECTION)),
      [SPEC.targets[1]]: doc(stale(SECTION)),
    };
    const first = syncSharedSections([SPEC], files);
    assert.deepEqual(syncSharedSections([SPEC], first.files), {
      files: first.files,
      changed: [],
      errors: [],
    });
  });

  it("keeps both sections when two specs share a target", () => {
    const spec = (h: string): SharedSection => ({
      heading: h,
      source: `skills/${h}/SKILL.md`,
      targets: ["agents/both.md"],
    });
    const [a, b] = [spec("A"), spec("B")];
    const section = (s: SharedSection, body: string) =>
      `## ${s.heading}\n\n${body}\n\n${endMarkerFor(s)}`;
    const both = (bodyA: string, bodyB: string) =>
      `# Both\n\nIntro.\n\n${section(a, bodyA)}\n\n${section(b, bodyB)}\n`;
    const files = {
      [a.source]: doc(section(a, "fresh a")),
      [b.source]: doc(section(b, "fresh b")),
      "agents/both.md": both("old a", "old b"),
    };
    assert.equal(
      syncSharedSections([a, b], files).files["agents/both.md"],
      both("fresh a", "fresh b"),
    );
  });

  it("changes nothing when the source has a broken fence", () => {
    const files = {
      [SPEC.source]: UNCLOSED,
      [SPEC.targets[0]]: doc(stale(SECTION)),
      [SPEC.targets[1]]: doc(stale(SECTION)),
    };
    assert.deepEqual(syncSharedSections([SPEC], files), {
      files,
      changed: [],
      errors: [`${SPEC.source}: ${UNCLOSED_PROBLEM}`],
    });
  });

  it("skips a target whose copy has no end marker instead of guessing where it ends", () => {
    const files = {
      [SPEC.source]: doc(SECTION),
      [SPEC.targets[0]]: doc(stale(SECTION)),
      [SPEC.targets[1]]: doc(stale(SECTION).replace(END, "")),
    };
    assert.deepEqual(syncSharedSections([SPEC], files), {
      files: { ...files, [SPEC.targets[0]]: doc(SECTION) },
      changed: [SPEC.targets[0]],
      errors: [
        `${
          SPEC.targets[1]
        }: ${TITLE} has no end marker; add \`${END}\` on its own line after the copy`,
      ],
    });
  });

  it("reports a registered target file that does not exist", () => {
    const files = { [SPEC.source]: doc(SECTION), [SPEC.targets[0]]: doc(SECTION) };
    assert.deepEqual(syncSharedSections([SPEC], files).errors, [
      `${SPEC.targets[1]}: file not found (registered in SHARED_SECTIONS)`,
    ]);
  });
});

describe("earlier versions", () => {
  it("allows moving a paragraph out of the section, since only unregistered files are searched for old text", () => {
    const moved = SECTION.replace(`${LONG}\n\n`, "");
    const files = {
      [SPEC.source]: BEFORE + moved + `\n\n${LONG}\n` + AFTER,
      [SPEC.targets[0]]: doc(moved),
      [SPEC.targets[1]]: doc(moved),
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files, [{ [SPEC.source]: doc(SECTION) }]), []);
  });

  it("names a registered file that repeats the section's current text outside the section", () => {
    const files = {
      [SPEC.source]: source(),
      [SPEC.targets[0]]: doc(SECTION),
      [SPEC.targets[1]]: doc(SECTION) + `\n${LONG}\n`,
    };
    assert.deepEqual(sharedSectionErrors([SPEC], files), [
      `${
        SPEC.targets[1]
      }: repeats text from ${TITLE} outside its section; keep the text in one place`,
    ]);
  });

  it("reads committed versions, skipping new files and warning outside git", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-committed-"));
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), "axiom-uncommitted-"));
    try {
      const git = (...args: string[]) =>
        assert.equal(
          spawnSync("git", args, { cwd: repo, encoding: "utf8" }).status,
          0,
          args.join(" "),
        );
      git("init", "-q");
      fs.writeFileSync(path.join(repo, "a.md"), "committed");
      git("add", ".");
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
      fs.writeFileSync(path.join(repo, "b.md"), "new since HEAD");
      assert.deepEqual(readCommittedVersions(repo, ["a.md", "b.md"]), {
        versions: { "a.md": "committed" },
        warnings: [],
      });
      assert.deepEqual(readCommittedVersions(plain, ["a.md"]).warnings, [
        "no committed version to compare with (not a git work tree, or no HEAD); stale copies of earlier section text are not checked",
      ]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });
});

describe("command line", () => {
  it("rejects an unknown argument instead of treating it as a build", () => {
    const script = path.join(import.meta.dirname!, "shared-sections.ts");
    assert.equal(spawnSync(process.execPath, [script, "--chek"], { encoding: "utf8" }).status, 2);
  });
});

describe("plugin repository", () => {
  it("has every registered copy matching its source and no unregistered copies", () => {
    const pluginDir = path.join(import.meta.dirname!, "../.claude-plugin/plugins/axiom");
    assert.deepEqual(checkSharedSections(pluginDir), { errors: [], warnings: [] });
  });
});
