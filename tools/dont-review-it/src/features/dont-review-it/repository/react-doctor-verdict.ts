const reactDoctorPassed = (outcome: {
  readonly error: string | undefined;
  readonly failed: boolean;
  readonly findings: readonly string[];
  readonly missing: readonly string[];
  readonly projects: number;
  readonly skipped: readonly string[];
  readonly unclassified: readonly string[];
}): boolean =>
  !outcome.failed &&
  outcome.error === undefined &&
  outcome.findings.length === 0 &&
  outcome.skipped.length === 0 &&
  outcome.unclassified.length === 0 &&
  outcome.projects > 0 &&
  outcome.missing.length === 0;

export { reactDoctorPassed };
