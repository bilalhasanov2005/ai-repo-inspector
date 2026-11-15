import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const serverPath = fileURLToPath(new URL("../src/mcp-server.ts", import.meta.url));

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

describe("review_repository over stdio", () => {
  let fixture: string;
  let workspace: string;
  let repository: string;
  let client: Client;

  beforeAll(async () => {
    fixture = mkdtempSync(join(realpathSync(tmpdir()), "inspector-mcp-"));
    workspace = join(fixture, "workspace");
    repository = join(workspace, "review target");
    mkdirSync(repository, { recursive: true });
    mkdirSync(join(workspace, "no checkout"));
    git(fixture, "init", "-b", "main");
    git(repository, "init", "-b", "main");
    git(repository, "config", "user.name", "Inspector Test");
    git(repository, "config", "user.email", "inspector-test@example.invalid");
    git(repository, "commit", "--allow-empty", "-m", "Initial commit");
    git(repository, "switch", "-c", "feature");
    writeFileSync(join(repository, "fixture-change.txt"), "example\n");
    git(repository, "add", "fixture-change.txt");
    git(repository, "commit", "-m", "Add fixture file");

    client = new Client({ name: "inspector-test", version: "1.0.0" });
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: ["--import", import.meta.resolve("tsx"), serverPath],
      cwd: fixture,
      env: { INSPECTOR_WORKSPACE_ROOT: workspace },
      stderr: "pipe",
    }));
  }, 10_000);

  afterAll(async () => {
    try {
      await client?.close();
    } finally {
      if (fixture) rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("advertises and inspects the requested repository", async () => {
    const { tools } = await client.listTools();
    expect(tools[0].inputSchema.required).toEqual(["repo_path"]);
    expect(tools[0].inputSchema.properties).not.toHaveProperty("validationCommands");

    const result = await client.callTool({
      name: "review_repository",
      arguments: { repo_path: "review target" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{
      type: "text",
      text: expect.stringContaining(
        "Compared the merge base with `main` to `HEAD`.\n\n" +
        "1 committed file changed. No validation commands were run.\n\n" +
        "## Changed files\n- `fixture-change.txt` (added)",
      ),
    }]);
  });

  it("rejects shell commands supplied by the caller", async () => {
    const marker = "mcp-command-ran.txt";
    const result = await client.callTool({
      name: "review_repository",
      arguments: { repo_path: repository, validationCommands: [`echo ran > ${marker}`] },
    });
    expect(result.isError).toBe(true);
    expect(existsSync(join(fixture, marker))).toBe(false);
    expect(existsSync(join(repository, marker))).toBe(false);
  });

  it.each(["..", "no checkout"])("rejects a path or checkout outside the workspace (%s)", async (repo_path) => {
    const result = await client.callTool({ name: "review_repository", arguments: { repo_path } });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{
      type: "text",
      text: expect.stringContaining("inside the configured workspace"),
    }]);
  });

  it("rejects a link inside the workspace that points outside it", async () => {
    symlinkSync(fixture, join(workspace, "outside-link"), "junction");
    const result = await client.callTool({
      name: "review_repository",
      arguments: { repo_path: "outside-link" },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects Git options passed as base refs", async () => {
    const result = await client.callTool({
      name: "review_repository",
      arguments: { repo_path: repository, baseRef: "--output=probe" },
    });
    expect(result.isError).toBe(true);
    expect(existsSync(join(repository, "probe...HEAD"))).toBe(false);
  });
});
