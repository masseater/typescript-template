const ANALYSIS_TIMEOUT = "Project analysis worker timed out";
const FSPY_SHARED_MEMORY = "fspy: failed to claim frame in shared memory";

/** @canonical-values dont-review-it.react-doctor-skip-detail */
const REACT_DOCTOR_SKIP_DETAILS = ["incomplete", "dead-code"] as const;

const REACT_DOCTOR_SKIP_DETAIL = {
  incomplete: REACT_DOCTOR_SKIP_DETAILS[0],
  deadCode: REACT_DOCTOR_SKIP_DETAILS[1],
} as const;

const detailOf = (entry: string): string => entry.split(" ").slice(1).join(" ");

const isTransientAnalysisFailure = (detail: string): boolean =>
  detail.includes(ANALYSIS_TIMEOUT) || detail.includes(FSPY_SHARED_MEMORY);

const skippedOnlyByTimeout = (skipped: readonly string[]): boolean =>
  skipped.some((entry) => isTransientAnalysisFailure(detailOf(entry))) &&
  skipped.every((entry) => {
    const detail = detailOf(entry);
    return (
      detail === REACT_DOCTOR_SKIP_DETAIL.incomplete ||
      detail === REACT_DOCTOR_SKIP_DETAIL.deadCode ||
      isTransientAnalysisFailure(detail)
    );
  });

export { ANALYSIS_TIMEOUT, FSPY_SHARED_MEMORY, REACT_DOCTOR_SKIP_DETAIL, skippedOnlyByTimeout };
