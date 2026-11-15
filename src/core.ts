import { changedFiles } from "./git.js";
import { markdownReport } from "./report.js";
import type { ReviewRequest } from "./types.js";
import { runValidations } from "./validation.js";

export async function reviewRepository(request: ReviewRequest) {
  const files = changedFiles(request.repositoryPath, request.baseRef);
  const validations = await runValidations(
    request.validationCommands ?? [],
    request.repositoryPath,
  );
  const report = markdownReport({
    repositoryPath: request.repositoryPath,
    changedFiles: files,
    validationResults: validations,
  });
  return { report, validationResults: validations };
}
