import { changedFiles, DEFAULT_BASE_REF } from "./git.js";
import { markdownReport } from "./report.js";
import type { ReviewRequest } from "./types.js";
import { runValidations } from "./validation.js";

export async function reviewRepository(request: ReviewRequest) {
  const baseRef = request.baseRef ?? DEFAULT_BASE_REF;
  const files = changedFiles(request.repositoryPath, baseRef);
  const validations = await runValidations(
    request.validationCommands ?? [],
    request.repositoryPath,
  );
  const report = markdownReport({
    repositoryPath: request.repositoryPath,
    baseRef,
    changedFiles: files,
    validationResults: validations,
  });
  return { report, validationResults: validations };
}
