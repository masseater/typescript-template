import { withoutCheckoutPath } from "./effect-typecheck-path.ts";

const missingExportCodes = ["TS2305", "TS2459", "TS2460", "TS2614", "TS2724"] as const;

type MissingExportCode = (typeof missingExportCodes)[number];

const locatedDiagnosticLine = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/u;
const prettyDiagnosticLine = /^(.+):(\d+):(\d+) - error (TS\d+): (.*)$/u;
const looseDiagnosticLine = /^error (TS\d+): (.*)$/u;

const textAt = (capturedText: readonly string[], index: number): string =>
  capturedText[index] ?? "";

type Diagnostic = {
  readonly file: string;
  readonly code: string;
  readonly message: string;
};

const diagnosticOf = (
  located: Readonly<{ file: string; code: string; diagnosticText: string }>,
): readonly Diagnostic[] =>
  located.code === "" || located.diagnosticText === ""
    ? []
    : [{ file: located.file, code: located.code, message: located.diagnosticText }];

const parseDiagnosticLine = (line: string): readonly Diagnostic[] => {
  const located = locatedDiagnosticLine.exec(line);
  if (located !== null) {
    return diagnosticOf({
      file: textAt([...located], 1),
      code: textAt([...located], 4),
      diagnosticText: textAt([...located], 5),
    });
  }
  const pretty = prettyDiagnosticLine.exec(line);
  if (pretty !== null) {
    return diagnosticOf({
      file: textAt([...pretty], 1),
      code: textAt([...pretty], 4),
      diagnosticText: textAt([...pretty], 5),
    });
  }
  const loose = looseDiagnosticLine.exec(line);
  if (loose === null) {
    return [];
  }
  return diagnosticOf({
    file: "",
    code: textAt([...loose], 1),
    diagnosticText: textAt([...loose], 2),
  });
};

const parseTscOutput = (compilerTranscript: string): readonly Diagnostic[] =>
  compilerTranscript.split(/\r?\n/u).flatMap(parseDiagnosticLine);

const portableDiagnostic = (diagnostic: Diagnostic, repositoryRootPath: string): Diagnostic => ({
  file: withoutCheckoutPath(diagnostic.file, repositoryRootPath),
  code: diagnostic.code,
  message: withoutCheckoutPath(diagnostic.message, repositoryRootPath),
});

const fingerprintOf = (diagnostic: Diagnostic): string =>
  JSON.stringify([diagnostic.file, diagnostic.code, diagnostic.message]);

type CountedDiagnostic = Diagnostic & { readonly count: number };

const compareCounted = (left: CountedDiagnostic, right: CountedDiagnostic): number => {
  const byFile = left.file.localeCompare(right.file);
  if (byFile !== 0) {
    return byFile;
  }
  const byCode = left.code.localeCompare(right.code);
  if (byCode !== 0) {
    return byCode;
  }
  return left.message.localeCompare(right.message);
};

const countDiagnostics = (diagnostics: readonly Diagnostic[]): readonly CountedDiagnostic[] => {
  const grouped = diagnostics.reduce<Readonly<Record<string, CountedDiagnostic>>>(
    (groupedDiagnostics, diagnostic) => {
      const fingerprint = fingerprintOf(diagnostic);
      const existing = groupedDiagnostics[fingerprint];
      return {
        ...groupedDiagnostics,
        [fingerprint]: { ...diagnostic, count: (existing?.count ?? 0) + 1 },
      };
    },
    {},
  );
  return Object.values(grouped).toSorted(compareCounted);
};

const missingExportCodeSet: ReadonlySet<string> = new Set(missingExportCodes);

const alwaysFailing = (diagnostics: readonly Diagnostic[]): readonly Diagnostic[] =>
  diagnostics.filter((diagnostic) => missingExportCodeSet.has(diagnostic.code));

const difference = (
  observed: readonly CountedDiagnostic[],
  snapshotted: readonly CountedDiagnostic[],
): readonly CountedDiagnostic[] => {
  const snapshottedByFingerprint = new Map(
    snapshotted.map((diagnostic) => [fingerprintOf(diagnostic), diagnostic.count]),
  );
  return observed.flatMap((diagnostic) => {
    const allowed = snapshottedByFingerprint.get(fingerprintOf(diagnostic)) ?? 0;
    if (diagnostic.count <= allowed) {
      return [];
    }
    return [{ ...diagnostic, count: diagnostic.count - allowed }];
  });
};

const expandRows = (countedDiagnostics: readonly CountedDiagnostic[]): readonly Diagnostic[] =>
  countedDiagnostics.flatMap((diagnostic) =>
    Array.from({ length: diagnostic.count }, () => ({
      file: diagnostic.file,
      code: diagnostic.code,
      message: diagnostic.message,
    })),
  );

type TypecheckVerdict = {
  readonly ok: boolean;
  readonly alwaysFail: readonly Diagnostic[];
  readonly unexpected: readonly CountedDiagnostic[];
  readonly leftover: readonly CountedDiagnostic[];
};

const evaluateTypecheck = (
  asked: Readonly<{
    diagnostics: readonly Diagnostic[];
    snapshotted: readonly CountedDiagnostic[];
  }>,
): TypecheckVerdict => {
  const alwaysFail = alwaysFailing(asked.diagnostics);
  const countable = countDiagnostics(
    asked.diagnostics.filter((diagnostic) => !missingExportCodeSet.has(diagnostic.code)),
  );
  const snapshotted = countDiagnostics(expandRows(asked.snapshotted));
  const unexpected = difference(countable, snapshotted);
  const leftover = difference(snapshotted, countable);
  return {
    ok: alwaysFail.length === 0 && unexpected.length === 0 && leftover.length === 0,
    alwaysFail,
    unexpected,
    leftover,
  };
};

const snapshotOf = (diagnostics: readonly Diagnostic[]): readonly CountedDiagnostic[] =>
  countDiagnostics(diagnostics.filter((diagnostic) => !missingExportCodeSet.has(diagnostic.code)));

const formatCounted = (countedDiagnostics: readonly CountedDiagnostic[]): string =>
  countedDiagnostics
    .map((diagnostic) => {
      const repeatSuffix = diagnostic.count === 1 ? "" : ` \u00d7${String(diagnostic.count)}`;
      return `${diagnostic.file}: error ${diagnostic.code}: ${diagnostic.message}${repeatSuffix}`;
    })
    .join("\n");

const formatDiagnostics = (diagnostics: readonly Diagnostic[]): string =>
  diagnostics
    .map((diagnostic) => `${diagnostic.file}: error ${diagnostic.code}: ${diagnostic.message}`)
    .join("\n");

const occurrenceTotal = (countedDiagnostics: readonly CountedDiagnostic[]): number =>
  countedDiagnostics.reduce((occurrenceSum, diagnostic) => occurrenceSum + diagnostic.count, 0);

const formatReport = (verdict: TypecheckVerdict): string => {
  const sections = [
    verdict.alwaysFail.length > 0
      ? `typecheck gate: ${String(verdict.alwaysFail.length)} missing-export errors\n${formatDiagnostics(verdict.alwaysFail)}`
      : undefined,
    verdict.unexpected.length > 0
      ? `typecheck gate: ${String(occurrenceTotal(verdict.unexpected))} new diagnostics\n${formatCounted(verdict.unexpected)}`
      : undefined,
    verdict.leftover.length > 0
      ? `typecheck gate: ${String(occurrenceTotal(verdict.leftover))} baselined diagnostics are gone; rewrite the snapshot\n${formatCounted(verdict.leftover)}`
      : undefined,
  ].filter((section): section is string => section !== undefined);
  return `${sections.join("\n")}\n`;
};

export {
  alwaysFailing,
  compareCounted,
  evaluateTypecheck,
  formatReport,
  parseTscOutput,
  portableDiagnostic,
  snapshotOf,
};
export type { CountedDiagnostic, Diagnostic };
