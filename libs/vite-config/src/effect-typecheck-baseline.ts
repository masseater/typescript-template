import { Schema } from "effect";

import { compareCounted, portableDiagnostic } from "./effect-typecheck-diagnostics.ts";

const BaselineRow = Schema.Struct({
  file: Schema.String,
  code: Schema.String,
  message: Schema.String,
  count: Schema.Finite,
});

const TypecheckBaseline = Schema.Struct({
  version: Schema.Literal(1),
  workspaces: Schema.Record(Schema.String, Schema.Array(BaselineRow)),
});

type TypecheckBaseline = typeof TypecheckBaseline.Type;

const parseBaseline = (baselineJson: string): TypecheckBaseline =>
  Schema.decodeSync(Schema.fromJsonString(TypecheckBaseline))(baselineJson);

const serializeBaseline = (baseline: TypecheckBaseline): string => {
  const workspaces = Object.fromEntries(
    Object.entries(baseline.workspaces)
      .filter(([, countedDiagnostics]) => countedDiagnostics.length > 0)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([workspace, countedDiagnostics]) => [
        workspace,
        [...countedDiagnostics].toSorted(compareCounted).map((diagnostic) => ({
          file: diagnostic.file,
          code: diagnostic.code,
          message: diagnostic.message,
          count: diagnostic.count,
        })),
      ]),
  );
  return `${JSON.stringify({ version: 1, workspaces }, null, 2)}\n`;
};

const portableBaseline = (
  baseline: TypecheckBaseline,
  repositoryRootPath: string,
): TypecheckBaseline => ({
  version: 1,
  workspaces: Object.fromEntries(
    Object.entries(baseline.workspaces).map(([workspace, countedDiagnostics]) => [
      workspace,
      countedDiagnostics.map((diagnostic) => ({
        ...portableDiagnostic(diagnostic, repositoryRootPath),
        count: diagnostic.count,
      })),
    ]),
  ),
});

export { parseBaseline, portableBaseline, serializeBaseline };
