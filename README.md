# Repository Inspector

This is a small TypeScript developer tool that inspects changes in a Git
repository, runs optional validation commands, and produces a Markdown report.
It can be used from a command line or exposed to AI clients through MCP.

## Your task

Investigate the repository and improve it as you judge best. The starter works
for a narrow happy path, but production use may expose correctness, safety,
reliability, contract, output, documentation, or testing weaknesses.

You are not expected to finish everything. We care about how you investigate,
prioritize, implement, verify, and explain a meaningful scope.

## Product decision

This tool may be used directly by developers and by AI coding agents. Decide
whether its production interface should be **CLI-first**, **MCP-first**, or
**hybrid**. Implement improvements consistent with your decision.

There is no preferred label. Explain:

- The primary user and execution environment you assumed.
- The trust boundary and allowed capabilities.
- Reliability, discoverability, latency/context, and output-size tradeoffs.
- How the interfaces you continue to advertise stay behaviorally consistent.
- What evidence would change your decision.

## Time and rules

- Maximum **90 focused minutes** within 48 hours of receiving the invitation.
- Use AI coding tools freely. Verify their work and document at least one
  suggestion you corrected or rejected.
- Work in your own repository created from this template.
- Commit as you work and complete `SUBMISSION.md` in your final commit.
- Completion is not required. Accurate scope and verification matter more than
  a large diff.

## Setup

```bash
npm install
npm run typecheck
npm test
```

## CLI

From this checkout, use `.` to review the current repository. To review another
checkout, replace `.` with its path and quote paths that contain spaces.

```bash
npm run inspector -- review --repo . --format markdown
npm run inspector -- review --repo . --validate "npm test"
```

The report starts with the comparison range, the number of committed files
changed, and a count of passed and failed validations when checks ran. By
default, it compares the merge base with `main` to `HEAD`, so reviewing
`main` from `main` reports zero changed files. Use `--base-ref <ref>` to
choose a different base. For example, `--base-ref HEAD~1` reviews the changes
since the previous commit.

The CLI writes `review-report.md` in the current directory. It runs each
explicit `--validate` command in the selected checkout. If any check fails,
the CLI still produces the report and exits with status 1.

Use `--stdout` to print the Markdown or redirect it to a file. The
`--silent` npm flag suppresses its script banner. The inspector sends its
confirmation to stderr, so the redirected file contains only Markdown.

```bash
npm run --silent inspector -- review --repo . --stdout > my-review.md
```

## MCP

Build the server, then configure your MCP client to launch the built JavaScript
with Node:

```bash
npm run build
node dist/src/mcp-server.js
```

Use an absolute path to `dist/src/mcp-server.js` if your client starts it from
another directory. The server uses its working directory as the workspace
root by default. Set `INSPECTOR_WORKSPACE_ROOT` in the server's environment
to select a workspace explicitly.

Call `review_repository` with `{"repo_path":"."}` to review the workspace
root. `repo_path` can be an absolute path or a path relative to the
configured workspace. The checkout must resolve inside that workspace.
You can also pass an optional `baseRef`. The tool returns the same Markdown
comparison summary and committed file list as the CLI. Run validation commands
through the CLI.

## Project layout

```text
src/core.ts         shared review orchestration
src/cli.ts          command-line adapter
src/mcp-server.ts   MCP adapter
src/git.ts          Git inspection
src/validation.ts   validation execution
src/report.ts       Markdown report generation
test/               public starter tests
```

When finished, submit via **Security → Report a vulnerability** on this
repo — see `SECURITY.md` for exactly what to include. Do not reply by email;
that submission channel is not monitored.