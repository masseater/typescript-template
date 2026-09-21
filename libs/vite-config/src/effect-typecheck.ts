import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";

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
import { workspaceOf } from "./effect-typecheck-path.ts";

const snapshotArgument = "--write";
const baselinePath = path.join(import.meta.dirname, "effect-typecheck-baseline.json");

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

type GateIo = {
  readonly cwd: string;
  readonly repositoryRoot: string;
  readonly gateArguments: readonly string[];
  readonly baselinePath: string;
  readonly compile: () => CompilerResult;
  readonly readText: (file: string) => string;
  readonly writeText: (file: string, baselineText: string) => void;
};

const parsedDiagnostics = (asked: GateIo, compiled: CompilerResult): readonly Diagnostic[] =>
  parseTscOutput(compiled.output).map((diagnostic) =>
    portableDiagnostic(diagnostic, asked.repositoryRoot),
  );

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

const loadBaseline = (asked: GateIo): ReturnType<typeof portableBaseline> =>
  portableBaseline(parseBaseline(asked.readText(asked.baselinePath)), asked.repositoryRoot);

const snapshotBaseline = (
  gate: Readonly<{
    asked: GateIo;
    workspace: string;
    diagnostics: readonly Diagnostic[];
    compilerTranscript: string;
  }>,
): GateRun => {
  const alwaysFail = alwaysFailing(gate.diagnostics);
  if (alwaysFail.length > 0) {
    return {
      exitStatus: 1,
      transcript: `${gate.compilerTranscript}${formatReport({ ok: false, alwaysFail, unexpected: [], leftover: [] })}`,
    };
  }
  const baseline = loadBaseline(gate.asked);
  gate.asked.writeText(
    gate.asked.baselinePath,
    serializeBaseline({
      version: 1,
      workspaces: { ...baseline.workspaces, [gate.workspace]: snapshotOf(gate.diagnostics) },
    }),
  );
  return { exitStatus: 0, transcript: gate.compilerTranscript };
};

const compareBaseline = (
  gate: Readonly<{
    asked: GateIo;
    workspace: string;
    diagnostics: readonly Diagnostic[];
    compilerTranscript: string;
  }>,
): GateRun => {
  const verdict = evaluateTypecheck({
    diagnostics: gate.diagnostics,
    snapshotted: rowsForWorkspace(loadBaseline(gate.asked), gate.workspace),
  });
  if (!verdict.ok) {
    return { exitStatus: 1, transcript: `${gate.compilerTranscript}${formatReport(verdict)}` };
  }
  return { exitStatus: 0, transcript: gate.compilerTranscript };
};

const workspaceVerdict = (
  gate: Readonly<{
    asked: GateIo;
    diagnostics: readonly Diagnostic[];
    compilerTranscript: string;
  }>,
): GateRun => {
  const workspace = workspaceOf(gate.asked.cwd, gate.asked.repositoryRoot);
  if (gate.asked.gateArguments.includes(snapshotArgument)) {
    return snapshotBaseline({ ...gate, workspace });
  }
  return compareBaseline({ ...gate, workspace });
};

const printedOutput = (compilerTranscript: string): string =>
  compilerTranscript.endsWith("\n") ? compilerTranscript : `${compilerTranscript}\n`;

const verdictOf = (asked: GateIo): GateRun => {
  const compiled = asked.compile();
  const compilerTranscript = printedOutput(compiled.output);
  const diagnostics = parsedDiagnostics(asked, compiled);
  const silent = missingCompilerDiagnostics({ compiled, diagnostics, compilerTranscript });
  if (silent !== undefined) {
    return silent;
  }
  return workspaceVerdict({ asked, diagnostics, compilerTranscript });
};

const runEffectTypecheck = (asked: GateIo): GateRun => {
  const rejected = rejectedArguments(asked.gateArguments);
  if (rejected !== undefined) {
    return rejected;
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
  compile: () => compileWorkspace({ cwd: asked.cwd }),
  readText: (file) => readFileSync(file, "utf-8"),
  writeText: (file, baselineText) => {
    writeFileSync(file, baselineText);
  },
});

const runTypecheckGate = (
  asked: Readonly<{ cwd: string; gateArguments: readonly string[] }>,
): GateRun => runEffectTypecheck(defaultGate(asked));

const scriptedTypecheck = (
  asked: Readonly<{
    gateArguments?: readonly string[];
    baselineText?: string;
    compilerTranscript?: string;
    status?: number;
    cwd?: string;
    repositoryRootPath?: string;
  }>,
): GateRun =>
  runEffectTypecheck({
    cwd: asked.cwd ?? "/repo",
    repositoryRoot: asked.repositoryRootPath ?? "/repo",
    gateArguments: asked.gateArguments ?? [],
    baselinePath: "baseline.json",
    compile: () => ({
      output: asked.compilerTranscript ?? "",
      status: asked.status ?? 0,
    }),
    readText: () =>
      asked.baselineText ?? `${JSON.stringify({ version: 1, workspaces: {} }, null, 2)}\n`,
    writeText: () => undefined,
  });

export { baselinePath, runEffectTypecheck, runTypecheckGate, scriptedTypecheck, snapshotArgument };
export type { GateIo, GateRun };
