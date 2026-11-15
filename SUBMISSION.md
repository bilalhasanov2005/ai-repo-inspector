# Submission

## What did you investigate first, and why?

I installed the dependencies and ran `npm run typecheck`, `npm run build`,
and `npm test` before editing the code. Everything passed, but the only
starter test checked whether a few words appeared in a sample report. It never
ran Git, launched the command-line tool, or called the MCP server.

I ran `git ls-files` to see what was in the repository and
`rg -n '^' src test .github/workflows` to read the source, tests, and CI
steps with line numbers. I followed `src/cli.ts` and `src/mcp-server.ts`
into `src/core.ts`, which calls Git, runs any requested checks, and builds
the report. I wanted to answer two questions first. Was the tool reviewing
the repository I asked for? Could a review do more than I expected?

- **Wrong repository.** I called the MCP tool with a temporary repository that
  had a known new file. The call reported success, but its heading was
  `Review Report: undefined` and the file was missing. The tool accepted
  `repo_path` and then looked for `repoPath`. Because that value was
  missing, Git ran in the server's own directory.
- **Unexpected side effects.** In another MCP call, I supplied a harmless
  `echo` command and saw its output in the report. I also tried
  `--output=probe` as the Git comparison base. The inspector passed it
  to Git as `--output=probe...HEAD`, and Git created a file named
  `probe...HEAD` in the temporary checkout.

I fixed these first because someone could receive a convincing report for the
wrong checkout, run a command through the agent interface, or create a file
during what looked like a read-only review.

## What did you choose to implement or fix?

1. **Make MCP review the right repository.** It uses the path you actually
   sent, checks that the repository is inside the allowed workspace, and
   rejects requests to run commands.
2. **Check what Git is comparing.** The inspector turns the branch, tag, or
   commit you give it into a commit ID first. This prevents a value like
   `--output=probe` from being passed to Git as an option.
3. **Keep the report when a check fails.** The CLI records the failure and
   its output, runs the remaining checks, and saves or prints the report.
   It exits with code 1 so a script can tell a check failed.
4. **Fix the CLI inputs and report formatting.** Quoted paths with spaces
   work, and invalid arguments get a clear error. Filenames display as text,
   and printed backticks stay inside the command output block.
5. **Add report delivery and a summary.** With `--stdout`, you can print
   the report or save it under your own filename. Both interfaces now show
   what was compared, how many files changed, and how many checks passed or failed.

## What did you intentionally not implement?

With 90 minutes available, I left two larger features for later. One would
review local edits before they are committed. The other would give MCP clients
individual fields they can read directly from a report. I used the time to
verify the fixes and the two smaller additions on both interfaces.

## Interface decision

I chose **hybrid**. The command-line interface (CLI) serves developers and CI
jobs. The local MCP server gives coding agents a tool they can call from a
workspace the developer chooses.

- **Who can do what.** An MCP client can ask for a Git review inside the
  configured workspace. The server follows filesystem links and checks where
  the actual Git checkout is before using it. A developer can deliberately
  run checks such as `npm test` through the CLI. Those commands run with
  the developer's permissions, so the checkout needs to be one they trust.
- **How the two interfaces stay consistent.** Both ask the same code to compare
  commits and build the same Markdown. The CLI can also run checks and sends
  the report to a file or standard output. MCP sends the report back to the
  client as the tool's response.
- **What the tradeoffs are.** The CLI gives terminal users a usage message and
  scripts a reliable success or failure code. MCP clients can discover the
  tool and its inputs and keep the server running between calls. Each call
  still waits for Git. A short summary helps people and agents read the result
  quickly, but a long file list or test log can make the full report large.
- **What would change my mind.** If most users ran reviews in CI or the terminal
  and few used MCP, I would put the CLI first. If agents regularly needed to
  extract specific fields or large reports were using too much of their
  available context, I would prioritize a smaller, structured MCP response.

## How did you use an AI coding agent?

I used Codex to read the repository, reproduce bugs, and discuss what I could
finish in 90 minutes. We reviewed the priority list together. I adjusted it
as we found problems, putting the fixes for reviewing the wrong repository,
running commands through MCP, and writing a file through Git first.

After each change, I asked Codex to run the tests and then tried the relevant
command myself before deciding whether to commit or move on. For example, I
ran the Git base-ref test from my terminal and checked the error and exit code.
I also tried redirecting a report to a file. Seeing the two empty sections
made me ask for a summary that explains what the tool found.

## Where did you check, correct, or reject an AI suggestion? (required)

The first AI-generated priority list put improving Git change detection in P2.
I agreed that broader change coverage could wait, but the
`--output=probe` experiment showed a separate problem. Git could write a
file during a review. I moved that fix to P0. The regression test now checks
both that the input is rejected and that `probe...HEAD` never appears.

## Commands used to verify the result, with outcomes

**Before changes**, on Windows with Node.js 24.18.0 and npm 11.16.0:

- `npm install` installed 143 packages. npm reported 15 dependency
  findings and flagged the esbuild setup script as pending approval.
- `npm run typecheck`, `npm run build`, and `npm test` passed.
  The starter ran 1 test.

**After changes**, at commit `65e81be`:

- `npm run typecheck`, `npm run build`, and `npm test` passed.
  The full suite ran **32 tests across 4 files**.
- `npm.cmd run --silent inspector -- review --repo . --base-ref HEAD~1 --validate "npm test" --stdout`
  exited 0. I redirected the Markdown to a file and checked that it listed
  six changed files and contained the passing test output.
- In a CLI test, the first command printed a normal message and an error
  message, then exited with code 7. The second command still ran and passed.
  The report showed both messages and both results, and the inspector exited 1.
- I launched `node dist/src/mcp-server.js` through an MCP client and called
  `review_repository` with `repo_path` set to `.` (the current directory)
  and `baseRef` set to `HEAD~1` (the previous commit). It reported the same
  six changed files.
  A separate request containing `validationCommands` returned an error.
- GitHub Actions also passed dependency installation, typecheck, build, and
  tests on Ubuntu with Node.js 20.
  [Public checks for the implementation](https://github.com/bilalhasanov2005/ai-repo-inspector/actions/runs/43688163664)

## A blocker you hit and how you approached it

It took me a while to decide whether to put the CLI or MCP first.
I compared what I would want as a developer running tests in a terminal with
what I would want an agent to do when reviewing a checkout. A developer needs
to run checks and get an exit code. An agent needs to request a review and get
the result without being given the ability to run arbitrary commands.

I chose hybrid once I could describe what each interface should do. Both use
the same code to inspect a repository and make the report. The developer runs
checks through the CLI, and the agent uses MCP to request a review inside the
configured workspace.

## Next three things I would do

1. Read Git's file list in a format that keeps filenames and rename records
   intact. Then add a mode to show local edits before they are committed.
2. Add a time limit for checks and cap the amount of output in the report.
   Show clearly when a command timed out or part of its log was shortened.
3. Check which dependency advisories apply to the code paths used by the CLI
   and local MCP server, then test targeted upgrades.

## Approximate focused-work time

- Start: About 10:00, 15 November 2026 (Asia/Baku).
- Finish: About 11:10, 15 November 2026 (Asia/Baku).

About 70 minutes from setup to final verification, including short review
pauses. These times are estimates based on command and commit timestamps.
