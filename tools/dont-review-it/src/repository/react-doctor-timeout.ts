const ANALYSIS_TIMEOUT = "Project analysis worker timed out";

const detailOf = (entry: string): string => entry.split(" ").slice(1).join(" ");

const skippedOnlyByTimeout = (skipped: readonly string[]): boolean =>
  skipped.some((entry) => detailOf(entry).includes(ANALYSIS_TIMEOUT)) &&
  skipped.every((entry) => {
    const detail = detailOf(entry);
    return detail === "incomplete" || detail === "dead-code" || detail.includes(ANALYSIS_TIMEOUT);
  });

export { ANALYSIS_TIMEOUT, skippedOnlyByTimeout };
