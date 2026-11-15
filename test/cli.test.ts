import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

describe("CLI validation", () => {
  let repository: string;

  beforeAll(() => {
    repository = mkdtempSync(join(tmpdir(), "inspector-cli-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repository, stdio: "pipe" });
    git("init", "-b", "main");
    git("config", "user.name", "Inspector Test");
    git("config", "user.email", "inspector-test@example.invalid");
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "Initial commit");
  });

  afterAll(() => {
    if (repository) rmSync(repository, { recursive: true, force: true });
  });

  function review(...args: string[]) {
    return spawnSync(process.execPath, [
      "--import", import.meta.resolve("tsx"), cliPath, "review", "--repo", ".", ...args,
    ], { cwd: repository, encoding: "utf8", timeout: 5_000 });
  }

  it("writes the report and runs later checks after a command fails", () => {
    const fails = `"${process.execPath}" -e "console.log(['first', 'stdout'].join(' ')); console.error(['first', 'stderr'].join(' ')); process.exitCode = 7"`;
    const passes = `"${process.execPath}" -e "console.log(['second', 'stdout'].join(' '))"`;
    const result = review("--validate", fails, "--validate", passes);

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
    const result = review("--validate", command);

    expect(result.status).toBe(0);
    const report = readFileSync(join(repository, "review-report.md"), "utf8");
    expect(report).toContain("**passed** (exit code 0)");
    expect(report).toContain("check stdout");
    expect(report).toContain("check stderr");
  });
});
