import { describe, expect, it } from "vitest";
import { markdownReport } from "../src/report.js";

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      baseRef: "main",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [{ command: "npm test", status: "passed", stdout: "ok", stderr: "", exitCode: 0 }],
    });

    expect(report).toContain("`src/index.ts` (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
  });

  it("keeps path and command markup on a single line as literal text", () => {
    const report = markdownReport({
      repositoryPath: "/work/[checkout](https://example.invalid)\n# fake title",
      baseRef: "main",
      changedFiles: [
        { path: "[click](https://example.invalid).md", status: "added" },
        { path: "`quoted`\tname\n# fake heading", status: "modified" },
      ],
      validationResults: [{
        command: "echo `one`\r\n## fake section",
        status: "passed",
        stdout: "",
        stderr: "",
      }],
    });

    expect(report.split("\n")).toEqual([
      "# Review Report: `/work/[checkout](https://example.invalid)\\n# fake title`",
      "",
      "Compared the merge base with `main` to `HEAD`.",
      "",
      "2 committed files changed. Validation: 1 passed, 0 failed.",
      "",
      "## Changed files",
      "- `[click](https://example.invalid).md` (added)",
      "- `` `quoted`\\tname\\n# fake heading `` (modified)",
      "",
      "## Validation output",
      "",
      "### ``echo `one`\\r\\n## fake section``",
      "",
      "Status: **passed**",
    ]);
  });

  it("uses longer fences when validation text contains its own fences", () => {
    const stdout = "first\n```\n# fake heading\n`````\nlast\n";
    const stderr = "```\n[click](https://example.invalid)";
    const error = "````\n<details>";
    const report = markdownReport({
      repositoryPath: ".",
      baseRef: "main",
      changedFiles: [],
      validationResults: [
        { command: "first", status: "failed", stdout, stderr, error },
        { command: "second", status: "passed", stdout: "still visible", stderr: "", exitCode: 0 },
      ],
    });

    expect(report).toContain(["stdout", "", "``````", stdout + "``````"].join("\n"));
    expect(report).toContain(["stderr", "", "````", stderr, "````"].join("\n"));
    expect(report).toContain(["Execution error", "", "`````", error, "`````", "", "### `second`"].join("\n"));
  });
});
