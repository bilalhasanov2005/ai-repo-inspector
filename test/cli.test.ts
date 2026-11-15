import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

describe("inspector review CLI", () => {
  let repository: string;

  beforeAll(() => {
    repository = mkdtempSync(join(tmpdir(), "inspector cli "));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repository, stdio: "pipe" });
    git("init", "-b", "main");
    git("config", "user.name", "Inspector Test");
    git("config", "user.email", "inspector-test@example.invalid");
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "Initial commit");
  });

  beforeEach(() => {
    rmSync(join(repository, "review-report.md"), { force: true });
  });

  afterAll(() => {
    if (repository) rmSync(repository, { recursive: true, force: true });
  });

  function review(...args: string[]) {
    return spawnSync(process.execPath, [
      "--import", import.meta.resolve("tsx"), cliPath, "review", ...args,
    ], { cwd: repository, encoding: "utf8", timeout: 5_000 });
  }

  it("preserves a repository path with spaces and accepts Markdown format", () => {
    const result = review("--repo", repository, "--base-ref", "main", "--format", "markdown");
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(repository, "review-report.md"), "utf8")).toContain(`# Review Report: \`${repository}\``);
  });

  it.each([
    { name: "unknown flag", args: ["--repo", ".", "--typo"], message: /unknown option '--typo'/i },
    { name: "extra positional argument", args: ["--repo", ".", "extra"], message: /unexpected argument 'extra'/i },
    { name: "missing repo", args: [], message: /missing required option --repo/i },
    { name: "missing repo value", args: ["--repo"], message: /option '--repo <value>' argument missing/i },
    { name: "missing base ref value", args: ["--repo", ".", "--base-ref", "--format", "markdown"], message: /argument is ambiguous/i },
    { name: "missing format value", args: ["--repo", ".", "--format"], message: /option '--format <value>' argument missing/i },
    { name: "missing validation value", args: ["--repo", ".", "--validate"], message: /option '--validate <value>' argument missing/i },
    { name: "empty base ref", args: ["--repo", ".", "--base-ref="], message: /--base-ref requires a nonempty value/i },
    { name: "blank validation command", args: ["--repo", ".", "--validate= "], message: /--validate requires a nonempty command/i },
    { name: "unsupported JSON format", args: ["--repo", ".", "--format", "json"], message: /unsupported format "json".*markdown/i },
  ])("rejects $name before writing a report", ({ args, message }) => {
    const result = review(...args);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(result.stderr).toContain("Usage: inspector review");
    expect(existsSync(join(repository, "review-report.md"))).toBe(false);
  });

  it("passes an explicit dash-leading base ref to the shared Git check", () => {
    const result = review("--repo", ".", "--base-ref=--output=probe");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid base ref "--output=probe"');
    expect(existsSync(join(repository, "probe...HEAD"))).toBe(false);
  });

  it("writes the report and runs later checks after a command fails", () => {
    const fails = `"${process.execPath}" -e "console.log(['first', 'stdout'].join(' ')); console.error(['first', 'stderr'].join(' ')); process.exitCode = 7"`;
    const passes = `"${process.execPath}" -e "console.log(['second', 'stdout'].join(' '))"`;
    const result = review("--repo", ".", "--validate", fails, "--validate", passes);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Review report written to review-report.md");
    const report = readFileSync(join(repository, "review-report.md"), "utf8");
    expect(report).toContain("**failed** (exit code 7)");
    expect(report).toContain("first stdout");
    expect(report).toContain("first stderr");
    expect(report).toContain("**passed** (exit code 0)");
    expect(report).toContain("second stdout");
    expect(report.indexOf("first stdout")).toBeLessThan(report.indexOf("second stdout"));
  });

  it("exits successfully when all checks pass and preserves both streams", () => {
    const command = `"${process.execPath}" -e "console.log(['check', 'stdout'].join(' ')); console.error(['check', 'stderr'].join(' '))"`;
    const result = review("--repo", ".", "--validate", command);

    expect(result.status).toBe(0);
    const report = readFileSync(join(repository, "review-report.md"), "utf8");
    expect(report).toContain("**passed** (exit code 0)");
    expect(report).toContain("check stdout");
    expect(report).toContain("check stderr");
  });

  it("prints the report to stdout and confirmation to stderr", () => {
    const reportPath = join(repository, "review-report.md");
    const result = review("--repo", ".", "--stdout");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr.trim()).toBe("Review report sent to standard output.");
    expect(existsSync(reportPath)).toBe(false);

    expect(review("--repo", ".").status).toBe(0);
    expect(result.stdout).toBe(`${readFileSync(reportPath, "utf8")}\n`);
  });

  it("prints the report to stdout and the failure notice to stderr", () => {
    const command = `"${process.execPath}" -e "process.exitCode = 7"`;
    const result = review("--repo", ".", "--stdout", "--validate", command);

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^# Review Report:/);
    expect(result.stdout).toContain("**failed** (exit code 7)");
    expect(result.stdout).not.toContain("One or more validation commands failed.");
    expect(result.stderr.trim().split(/\r?\n/)).toEqual([
      "Review report sent to standard output.",
      "One or more validation commands failed.",
    ]);
    expect(existsSync(join(repository, "review-report.md"))).toBe(false);
  });
});
