import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

export function runValidation(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      const result = { command, stdout, stderr };
      if (!error) {
        resolve({ ...result, status: "passed", exitCode: 0 });
        return;
      }
      if (typeof error.code === "number") {
        resolve({ ...result, status: "failed", exitCode: error.code });
        return;
      }
      resolve({
        ...result,
        status: "failed",
        error: error.signal ? `Terminated by ${error.signal}.` : error.message,
      });
    });
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}
