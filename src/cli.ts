#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { reviewRepository } from "./core.js";
import type { ReviewRequest } from "./types.js";

const usage = "Usage: inspector review --repo <path> [--base-ref <ref>] [--format markdown] [--stdout] [--validate <command>]...";

function parseReviewArgs(argv: string[]): { request: ReviewRequest; toStdout: boolean } {
  const [command, ...args] = argv;
  if (command === undefined) throw new Error("Missing command. Expected review.");
  if (command !== "review") throw new Error(`Unknown command ${JSON.stringify(command)}. Expected review.`);

  const { values } = parseArgs({
    args,
    options: {
      repo: { type: "string" },
      "base-ref": { type: "string" },
      format: { type: "string" },
      stdout: { type: "boolean", default: false },
      validate: { type: "string", multiple: true },
    },
  });

  if (!values.repo) throw new Error("Missing required option --repo <path>.");
  if (values["base-ref"] === "") throw new Error("--base-ref requires a nonempty value.");
  if (values.format !== undefined && values.format !== "markdown") {
    throw new Error(`Unsupported format ${JSON.stringify(values.format)}. Use markdown.`);
  }
  if (values.validate?.some((command) => command.trim() === "")) {
    throw new Error("--validate requires a nonempty command.");
  }

  return {
    request: {
      repositoryPath: values.repo,
      baseRef: values["base-ref"],
      validationCommands: values.validate,
    },
    toStdout: values.stdout,
  };
}

async function main() {
  let args: ReturnType<typeof parseReviewArgs>;
  try {
    args = parseReviewArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  const { report, validationResults } = await reviewRepository(args.request);
  if (args.toStdout) {
    process.stdout.write(`${report}\n`);
    console.error("Review report sent to standard output.");
  } else {
    writeFileSync("review-report.md", report, "utf8");
    console.log("Review report written to review-report.md");
  }
  if (validationResults.some((result) => result.status === "failed")) {
    console.error("One or more validation commands failed.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
