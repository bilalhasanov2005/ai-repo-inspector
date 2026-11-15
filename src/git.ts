import { execFileSync } from "node:child_process";
import type { ChangedFile } from "./types.js";

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveBaseCommit(repositoryPath: string, baseRef: string): string {
  try {
    return git(repositoryPath, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${baseRef}^{commit}`]);
  } catch (error) {
    // rev-parse --quiet exits with 1 when the revision does not resolve.
    if (error instanceof Error && "status" in error && error.status === 1) {
      throw new Error(`Invalid base ref ${JSON.stringify(baseRef)}. It must resolve to a commit.`);
    }
    throw error;
  }
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const baseCommit = resolveBaseCommit(repositoryPath, baseRef ?? "main");
  const output = git(repositoryPath, ["diff", "--name-status", `${baseCommit}...HEAD`, "--"]);

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, ...pathParts] = line.split("\t");
      const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
      return { path: pathParts.join("\t"), status };
    });
}
