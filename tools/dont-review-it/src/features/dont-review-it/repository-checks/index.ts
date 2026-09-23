export type { CheckOutcome, ScannedProblems } from "./check-outcome.ts";
export { measureCheck } from "./check-telemetry.ts";
export {
  createCliRunner,
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  misuseOf,
  type CliResult,
} from "./cli-result.ts";
export { gitExecutablePath } from "./git-executable.ts";
export {
  DOCUMENT_SUFFIX,
  normativeDocumentPlacesIn,
  normativeDocumentsIn,
  type NormativeDocumentPlaces,
} from "./normative-document-places.ts";
export type { RepositoryProblem } from "./problem.ts";
