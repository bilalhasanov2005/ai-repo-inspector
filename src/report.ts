import type { ChangedFile, ValidationResult } from "./types.js";

type ReportInput = {
  repositoryPath: string;
  baseRef: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

function backtickDelimiter(text: string, minimumLength: number): string {
  let length = minimumLength;
  for (const [run] of text.matchAll(/`+/g)) {
    length = Math.max(length, run.length + 1);
  }
  return "`".repeat(length);
}

function inlineCode(value: string): string {
  const text = value.replaceAll("\r", "\\r").replaceAll("\n", "\\n").replaceAll("\t", "\\t");
  if (!text) return "";
  const delimiter = backtickDelimiter(text, 1);
  // Padding separates edge backticks and preserves spaces during Markdown parsing.
  const padding = /^[` ]|[` ]$/.test(text) && /[^ ]/.test(text) ? " " : "";
  return `${delimiter}${padding}${text}${padding}${delimiter}`;
}

function codeBlock(text: string): string {
  const fence = backtickDelimiter(text, 3);
  const lineBreak = text.endsWith("\n") ? "" : "\n";
  return `${fence}\n${text}${lineBreak}${fence}`;
}

export function markdownReport(input: ReportInput): string {
  const fileCount = input.changedFiles.length;
  const files = fileCount === 1 ? "file" : "files";
  const checkCount = input.validationResults.length;
  const failures = input.validationResults.filter((result) => result.status === "failed").length;
  const validationSummary = checkCount === 0
    ? "No validation commands were run."
    : `Validation: ${checkCount - failures} passed, ${failures} failed.`;

  const lines = [
    `# Review Report: ${inlineCode(input.repositoryPath)}`,
    "",
    `Compared the merge base with ${inlineCode(input.baseRef)} to ${inlineCode("HEAD")}.`,
    "",
    `${fileCount} committed ${files} changed. ${validationSummary}`,
    "",
    "## Changed files",
  ];
  for (const file of input.changedFiles) {
    lines.push(`- ${inlineCode(file.path)} (${file.status})`);
  }
  lines.push("", "## Validation output");
  for (const result of input.validationResults) {
    const exitCode = result.exitCode === undefined ? "" : ` (exit code ${result.exitCode})`;
    lines.push("", `### ${inlineCode(result.command)}`, "", `Status: **${result.status}**${exitCode}`);
    if (result.stdout) lines.push("", "stdout", "", codeBlock(result.stdout));
    if (result.stderr) lines.push("", "stderr", "", codeBlock(result.stderr));
    if (result.error) lines.push("", "Execution error", "", codeBlock(result.error));
  }
  return lines.join("\n");
}
