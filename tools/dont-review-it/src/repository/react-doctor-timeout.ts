const ANALYSIS_TIMEOUT = "Project analysis worker timed out";
const ANALYSIS_WORKER_EXITED = "Project analysis worker exited";
const FSPY_FRAME = "fspy: failed to claim frame";

const detailOf = (entry: string): string => entry.split(" ").slice(1).join(" ");

const isTransientAnalysisFailure = (detail: string): boolean =>
  detail.includes(ANALYSIS_TIMEOUT) ||
  detail.includes(ANALYSIS_WORKER_EXITED) ||
  detail.includes(FSPY_FRAME);

const skippedOnlyByTimeout = (skipped: readonly string[]): boolean =>
  skipped.some((entry) => isTransientAnalysisFailure(detailOf(entry))) &&
  skipped.every((entry) => {
    const detail = detailOf(entry);
    return detail === "incomplete" || detail === "dead-code" || isTransientAnalysisFailure(detail);
  });

export { ANALYSIS_TIMEOUT, skippedOnlyByTimeout };
