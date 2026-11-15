#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";

const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });
const workspaceRoot = realpathSync(process.env.INSPECTOR_WORKSPACE_ROOT ?? process.cwd());
if (!statSync(workspaceRoot).isDirectory()) {
  throw new Error("INSPECTOR_WORKSPACE_ROOT must point to a directory.");
}

function assertWithinWorkspace(path: string): void {
  const fromRoot = relative(workspaceRoot, path);
  if (isAbsolute(fromRoot) || fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
    throw new Error("Repository path must be inside the configured workspace.");
  }
}

function resolveRepositoryPath(inputPath: string): string {
  const requested = resolve(workspaceRoot, inputPath);
  assertWithinWorkspace(requested);
  const actual = realpathSync(requested);
  assertWithinWorkspace(actual);

  // Git can walk up from a non-repository directory and find a checkout above the workspace.
  const topLevel = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: actual,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).replace(/\r?\n$/, "");
  const repositoryPath = realpathSync(topLevel);
  assertWithinWorkspace(repositoryPath);
  return repositoryPath;
}

server.registerTool(
  "review_repository",
  {
    description: "Inspects a Git repository within the configured workspace and returns a Markdown report.",
    inputSchema: z.object({
      repo_path: z.string().min(1).describe("Repository path, absolute or relative to the configured workspace."),
      baseRef: z.string().min(1).regex(/^[^-]/, "Base ref cannot start with a dash.").optional(),
    }).strict(),
  },
  async ({ repo_path, baseRef }) => {
    const { report } = await reviewRepository({
      repositoryPath: resolveRepositoryPath(repo_path),
      baseRef,
    });
    return { content: [{ type: "text", text: report }] };
  },
);

await server.connect(new StdioServerTransport());
