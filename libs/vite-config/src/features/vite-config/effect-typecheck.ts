import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, type PlatformError, type Schema } from "effect";

import {
  parseBaseline,
  portableBaseline,
  rowsForWorkspace,
  serializeBaseline,
} from "./effect-typecheck-baseline.ts";
import { compileWorkspace, type CompilerResult } from "./effect-typecheck-compiler.ts";
import {
  alwaysFailing,
  evaluateTypecheck,
  formatReport,
  parseTscOutput,
  portableDiagnostic,
  snapshotOf,
  type Diagnostic,
} from "./effect-typecheck-diagnostics.ts";
import { checkoutRoots, workspaceOf, type OutsideRepository } from "./effect-typecheck-path.ts";
import { filesystem, paths } from "./host.ts";

const snapshotArgument = "--write";
const baselinePath = paths.join(import.meta.dirname, "effect-typecheck-baseline.json");

const unknownArguments = (gateArguments: readonly string[]): readonly string[] =>
  gateArguments.filter((argument) => argument !== snapshotArgument);

type GateRun = {
  readonly exitStatus: number;
  readonly transcript: string;
};

const rejectedArguments = (gateArguments: readonly string[]): GateRun | undefined => {
  const rejected = unknownArguments(gateArguments);
  if (rejected.length === 0) {
    return undefined;
  }
  return { exitStatus: 1, transcript: `Unknown option ${rejected.join(", ")}.\n` };
};

type GateFailure = PlatformError.PlatformError | OutsideRepository | Schema.SchemaError;

const parsedDiagnostics = (
  compiled: CompilerResult,
  roots: readonly string[],
): readonly Diagnostic[] =>
  parseTscOutput(compiled.output).map((diagnostic) => portableDiagnostic(diagnostic, roots));

const missingCompilerDiagnostics = (
  gate: Readonly<{
    compiled: CompilerResult;
    diagnostics: readonly Diagnostic[];
    compilerTranscript: string;
  }>,
): GateRun | undefined => {
  if (gate.diagnostics.length === 0 && gate.compiled.status !== 0) {
    return {
      exitStatus: 1,
      transcript: `${gate.compilerTranscript}typecheck gate: compiler exited without diagnostics\n`,
    };
  }
  return undefined;
};

type GateIo = {
  readonly cwd: string;
  readonly repositoryRoot: string;
  readonly gateArguments: readonly string[];
  readonly baselinePath: string;
  readonly compile: Effect.Effect<CompilerResult>;
  readonly readText: (file: string) => Effect.Effect<string, PlatformError.PlatformError>;
  readonly writeText: (
    file: string,
    baselineText: string,
  ) => Effect.Effect<void, PlatformError.PlatformError>;
};

type CheckedGate = Readonly<{
  asked: GateIo;
  roots: readonly string[];
  diagnostics: readonly Diagnostic[];
  compilerTranscript: string;
}>;

const loadBaseline = (
  gate: CheckedGate,
): Effect.Effect<
  ReturnType<typeof portableBaseline>,
  PlatformError.PlatformError | Schema.SchemaError
> =>
  gate.asked.readText(gate.asked.baselinePath).pipe(
    Effect.flatMap(parseBaseline),
    Effect.map((baseline) => portableBaseline(baseline, gate.roots)),
  );

const snapshotBaseline = Effect.fn("snapshotBaseline")(function* snapshotBaseline(
  gate: CheckedGate,
  workspace: string,
) {
  const alwaysFail = alwaysFailing(gate.diagnostics);
  if (alwaysFail.length > 0) {
    const refused: GateRun = {
      exitStatus: 1,
      transcript: `${gate.compilerTranscript}${formatReport({ ok: false, alwaysFail, unexpected: [], leftover: [] })}`,
    };
    return refused;
  }
  const baseline = yield* loadBaseline(gate);
  yield* gate.asked.writeText(
    gate.asked.baselinePath,
    serializeBaseline({
      version: 1,
      workspaces: { ...baseline.workspaces, [workspace]: snapshotOf(gate.diagnostics) },
    }),
  );
  const written: GateRun = { exitStatus: 0, transcript: gate.compilerTranscript };
  return written;
});

const compareBaseline = Effect.fn("compareBaseline")(function* compareBaseline(
  gate: CheckedGate,
  workspace: string,
) {
  const verdict = evaluateTypecheck({
    diagnostics: gate.diagnostics,
    snapshotted: rowsForWorkspace(yield* loadBaseline(gate), workspace),
  });
  const compared: GateRun = verdict.ok
    ? { exitStatus: 0, transcript: gate.compilerTranscript }
    : { exitStatus: 1, transcript: `${gate.compilerTranscript}${formatReport(verdict)}` };
  return compared;
});

const workspaceVerdict = (gate: CheckedGate): Effect.Effect<GateRun, GateFailure> =>
  Effect.flatMap(workspaceOf(gate.asked.cwd, gate.asked.repositoryRoot), (workspace) =>
    gate.asked.gateArguments.includes(snapshotArgument)
      ? snapshotBaseline(gate, workspace)
      : compareBaseline(gate, workspace),
  );

const printedOutput = (compilerTranscript: string): string =>
  compilerTranscript.endsWith("\n") ? compilerTranscript : `${compilerTranscript}\n`;

const verdictOf = Effect.fn("verdictOf")(function* verdictOf(asked: GateIo) {
  const compiled = yield* asked.compile;
  const roots = yield* checkoutRoots(asked.repositoryRoot);
  const compilerTranscript = printedOutput(compiled.output);
  const diagnostics = parsedDiagnostics(compiled, roots);
  const silent = missingCompilerDiagnostics({ compiled, diagnostics, compilerTranscript });
  if (silent !== undefined) {
    return silent;
  }
  return yield* workspaceVerdict({ asked, roots, diagnostics, compilerTranscript });
});

const runEffectTypecheck = (asked: GateIo): Effect.Effect<GateRun, GateFailure> => {
  const rejected = rejectedArguments(asked.gateArguments);
  if (rejected !== undefined) {
    return Effect.succeed(rejected);
  }
  return verdictOf(asked);
};

const defaultGate = (
  asked: Readonly<{ cwd: string; gateArguments: readonly string[] }>,
): GateIo => ({
  cwd: asked.cwd,
  repositoryRoot,
  gateArguments: asked.gateArguments,
  baselinePath,
  compile: compileWorkspace({ cwd: asked.cwd }),
  readText: (file) => filesystem.readFileString(file),
  writeText: (file, baselineText) => filesystem.writeFileString(file, baselineText),
});

const runTypecheckGate = (
  asked: Readonly<{
    cwd?: string;
    gateArguments?: readonly string[];
    repositoryRootPath?: string;
    baselinePath?: string;
    baselineText?: string;
    compilerTranscript?: string;
    status?: number;
  }>,
): Effect.Effect<GateRun, GateFailure> => {
  const cwd = asked.cwd ?? "/repo";
  const gateArguments = asked.gateArguments ?? [];
  if (
    asked.baselineText !== undefined ||
    asked.compilerTranscript !== undefined ||
    asked.status !== undefined ||
    asked.baselinePath !== undefined ||
    asked.repositoryRootPath !== undefined
  ) {
    return runEffectTypecheck({
      cwd,
      repositoryRoot: asked.repositoryRootPath ?? "/repo",
      gateArguments,
      baselinePath: asked.baselinePath ?? "baseline.json",
      compile: Effect.sync(() => ({
        output: asked.compilerTranscript ?? "",
        status: asked.status ?? 0,
      })),
      readText: () =>
        Effect.sync(() => asked.baselineText ?? serializeBaseline({ version: 1, workspaces: {} })),
      writeText: () => Effect.void,
    });
  }
  return runEffectTypecheck(defaultGate({ cwd, gateArguments }));
};

export { baselinePath, runTypecheckGate };
export type { GateFailure, GateRun };
