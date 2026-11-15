import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";

describe("changedFiles base ref", () => {
  let repository: string;
  let baseCommit: string;

  function git(...args: string[]): string {
    return execFileSync("git", args, {
      cwd: repository,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  }

  beforeAll(() => {
    repository = mkdtempSync(join(tmpdir(), "inspector-git-"));
    git("init", "-b", "main");
    git("config", "user.name", "Inspector Test");
    git("config", "user.email", "inspector-test@example.invalid");
    git("config", "commit.gpgsign", "false");
    git("commit", "--allow-empty", "-m", "Initial commit");
    git("tag", "-a", "base-tag", "-m", "Test base");
    baseCommit = git("rev-parse", "HEAD");
    git("switch", "-c", "feature");
    writeFileSync(join(repository, "change.txt"), "hello\n");
    git("add", "change.txt");
    git("commit", "-m", "Add fixture file");
  });

  afterAll(() => {
    if (repository) rmSync(repository, { recursive: true, force: true });
  });

  it.each([undefined, "main", "base-tag"])("compares against %s", (baseRef) => {
    expect(changedFiles(repository, baseRef)).toEqual([{ path: "change.txt", status: "added" }]);
  });

  it("accepts a commit ID", () => {
    expect(changedFiles(repository, baseCommit)).toEqual([{ path: "change.txt", status: "added" }]);
  });

  it("rejects a missing base ref", () => {
    expect(() => changedFiles(repository, "missing-base")).toThrow(/invalid base ref.*missing-base/i);
  });

  it("rejects a Git object that cannot resolve to a commit", () => {
    const blob = git("rev-parse", "HEAD:change.txt");
    expect(() => changedFiles(repository, blob)).toThrow(/invalid base ref/i);
  });

  it("rejects an option-shaped base ref without writing an output file", () => {
    expect.soft(() => changedFiles(repository, "--output=probe")).toThrow(/invalid base ref/i);
    expect(existsSync(join(repository, "probe...HEAD"))).toBe(false);
  });
});
