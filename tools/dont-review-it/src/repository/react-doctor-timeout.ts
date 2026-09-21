const ANALYSIS_TIMEOUT = "Project analysis worker timed out";

/** @canonical-values dont-review-it.react-doctor-skip-detail */
const REACT_DOCTOR_SKIP_DETAILS = ["incomplete", "dead-code"] as const;

const REACT_DOCTOR_SKIP_DETAIL = {
  incomplete: REACT_DOCTOR_SKIP_DETAILS[0],
  deadCode: REACT_DOCTOR_SKIP_DETAILS[1],
} as const;

const detailOf = (entry: string): string => entry.split(" ").slice(1).join(" ");

const skippedOnlyByTimeout = (skipped: readonly string[]): boolean =>
  skipped.some((entry) => detailOf(entry).includes(ANALYSIS_TIMEOUT)) &&
  skipped.every((entry) => {
    const detail = detailOf(entry);
    return (
      detail === REACT_DOCTOR_SKIP_DETAIL.incomplete ||
      detail === REACT_DOCTOR_SKIP_DETAIL.deadCode ||
      detail.includes(ANALYSIS_TIMEOUT)
    );
  });

export { ANALYSIS_TIMEOUT, REACT_DOCTOR_SKIP_DETAIL, skippedOnlyByTimeout };
