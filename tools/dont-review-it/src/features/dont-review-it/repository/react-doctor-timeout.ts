const ANALYSIS_TIMEOUT = "Project analysis worker timed out";
const FSPY_SHARED_MEMORY = "fspy: failed to claim frame in shared memory";

const detailOf = (entry: string): string => entry.split(" ").slice(1).join(" ");

const isTransientAnalysisFailure = (detail: string): boolean =>
  detail.includes(ANALYSIS_TIMEOUT) || detail.includes(FSPY_SHARED_MEMORY);

const skippedOnlyByTimeout = (skipped: readonly string[]): boolean =>
  skipped.some((entry) => isTransientAnalysisFailure(detailOf(entry))) &&
  skipped.every((entry) => {
    const detail = detailOf(entry);
    return detail === "incomplete" || detail === "dead-code" || isTransientAnalysisFailure(detail);
  });

export { ANALYSIS_TIMEOUT, FSPY_SHARED_MEMORY, skippedOnlyByTimeout };
