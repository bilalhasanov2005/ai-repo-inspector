import type { ChangedFile, ValidationResult } from "./types.js";

type ReportInput = {
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

export function markdownReport(input: ReportInput): string {
  const lines = [`# Review Report: ${input.repositoryPath}`, "", "## Changed files"];
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }
  lines.push("", "## Validation output");
  for (const result of input.validationResults) {
    const exitCode = result.exitCode === undefined ? "" : ` (exit code ${result.exitCode})`;
    lines.push("", `### ${result.command}`, "", `Status: **${result.status}**${exitCode}`);
    if (result.stdout) lines.push("", "stdout", "", "```", result.stdout, "```");
    if (result.stderr) lines.push("", "stderr", "", "```", result.stderr, "```");
    if (result.error) lines.push("", "Execution error", "", "```", result.error, "```");
  }
  return lines.join("\n");
}
