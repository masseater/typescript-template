#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { repositoryRoot } from "@repo/config/repository-root";
import { Schema } from "effect";

const missingExportCodes = ["TS2305", "TS2459", "TS2460", "TS2614", "TS2724"] as const;

type MissingExportCode = (typeof missingExportCodes)[number];

const missingExportCodeSet: ReadonlySet<string> = new Set(missingExportCodes);

const writeFlag = "--write";

const baselinePath = path.join(import.meta.dirname, "effect-typecheck-baseline.json");

const BaselineEntry = Schema.Struct({
  file: Schema.String,
  code: Schema.String,
  message: Schema.String,
  count: Schema.Finite,
});

const TypecheckBaseline = Schema.Struct({
  version: Schema.Literal(1),
  workspaces: Schema.Record(Schema.String, Schema.Array(BaselineEntry)),
});

type TypecheckBaseline = typeof TypecheckBaseline.Type;
type BaselineEntry = typeof BaselineEntry.Type;

type Diagnostic = {
  readonly file: string;
  readonly code: string;
  readonly message: string;
};

type CountedDiagnostic = Diagnostic & { readonly count: number };

type CompilerResult = {
  readonly output: string;
  readonly status: number;
};

type TypecheckVerdict = {
  readonly ok: boolean;
  readonly alwaysFail: readonly Diagnostic[];
  readonly unexpected: readonly CountedDiagnostic[];
  readonly leftover: readonly CountedDiagnostic[];
};

type TypecheckIo = {
  readonly cwd: string;
  readonly repositoryRoot: string;
  readonly args: readonly string[];
  readonly baselinePath: string;
  readonly compile: () => CompilerResult;
  readonly readText: (file: string) => string;
  readonly writeText: (file: string, text: string) => void;
  readonly print: (text: string) => void;
};

const locatedDiagnosticLine = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/u;
const prettyDiagnosticLine = /^(.+):(\d+):(\d+) - error (TS\d+): (.*)$/u;
const looseDiagnosticLine = /^error (TS\d+): (.*)$/u;

const checkoutMarker = "<repo>";

const checkoutRoots = (repositoryRoot: string): readonly string[] => {
  const resolved = path.resolve(repositoryRoot);
  try {
    const real = realpathSync(resolved);
    return real === resolved ? [resolved] : [real, resolved];
  } catch {
    return [resolved];
  }
};

const withoutCheckoutPath = (text: string, repositoryRoot: string): string => {
  const roots = checkoutRoots(repositoryRoot).toSorted((left, right) => right.length - left.length);
  let current = text;
  for (const root of roots) {
    let result = "";
    let cursor = 0;
    while (cursor < current.length) {
      const found = current.indexOf(root, cursor);
      if (found === -1) {
        result += current.slice(cursor);
        break;
      }
      const after = found + root.length;
      const next = current[after];
      result += current.slice(cursor, found);
      if (next === undefined || next === "/") {
        result += checkoutMarker;
      } else {
        result += root;
      }
      cursor = after;
    }
    current = result;
  }
  return current;
};

const portableDiagnostic = (diagnostic: Diagnostic, repositoryRoot: string): Diagnostic => ({
  file: withoutCheckoutPath(diagnostic.file, repositoryRoot),
  code: diagnostic.code,
  message: withoutCheckoutPath(diagnostic.message, repositoryRoot),
});

const portableBaseline = (
  baseline: TypecheckBaseline,
  repositoryRoot: string,
): TypecheckBaseline => ({
  version: 1,
  workspaces: Object.fromEntries(
    Object.entries(baseline.workspaces).map(([workspace, entries]) => [
      workspace,
      entries.map((entry) => ({
        ...portableDiagnostic(entry, repositoryRoot),
        count: entry.count,
      })),
    ]),
  ),
});

const fingerprintOf = (entry: Diagnostic): string =>
  JSON.stringify([entry.file, entry.code, entry.message]);

const compareCounted = (left: CountedDiagnostic, right: CountedDiagnostic): number => {
  const file = left.file.localeCompare(right.file);
  if (file !== 0) {
    return file;
  }
  const code = left.code.localeCompare(right.code);
  if (code !== 0) {
    return code;
  }
  return left.message.localeCompare(right.message);
};

const diagnosticOf = (
  file: string | undefined,
  code: string | undefined,
  message: string | undefined,
): readonly Diagnostic[] =>
  file === undefined || code === undefined || message === undefined
    ? []
    : [{ file, code, message }];

const parseTscOutput = (output: string): readonly Diagnostic[] =>
  output.split(/\r?\n/u).flatMap((line) => {
    const located = locatedDiagnosticLine.exec(line);
    if (located !== null) {
      return diagnosticOf(located[1], located[4], located[5]);
    }
    const pretty = prettyDiagnosticLine.exec(line);
    if (pretty !== null) {
      return diagnosticOf(pretty[1], pretty[4], pretty[5]);
    }
    const loose = looseDiagnosticLine.exec(line);
    if (loose === null) {
      return [];
    }
    return diagnosticOf("", loose[1], loose[2]);
  });

const countDiagnostics = (diagnostics: readonly Diagnostic[]): readonly CountedDiagnostic[] => {
  const counts = new Map<string, CountedDiagnostic>();
  for (const diagnostic of diagnostics) {
    const fingerprint = fingerprintOf(diagnostic);
    const existing = counts.get(fingerprint);
    counts.set(fingerprint, {
      ...diagnostic,
      count: (existing?.count ?? 0) + 1,
    });
  }
  return [...counts.values()].toSorted(compareCounted);
};

const workspaceOf = (cwd: string, repositoryRoot: string): string => {
  const resolvedCwd = path.resolve(cwd);
  const resolvedRoot = path.resolve(repositoryRoot);
  const relative = path.relative(resolvedRoot, resolvedCwd);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${resolvedCwd} is outside ${resolvedRoot}`);
  }
  return relative === "" ? "." : relative.split(path.sep).join("/");
};

const parseBaseline = (text: string): TypecheckBaseline =>
  Schema.decodeSync(Schema.fromJsonString(TypecheckBaseline))(text);

const serializeBaseline = (baseline: TypecheckBaseline): string => {
  const workspaces = Object.fromEntries(
    Object.entries(baseline.workspaces)
      .filter(([, entries]) => entries.length > 0)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([workspace, entries]) => [
        workspace,
        [...entries].toSorted(compareCounted).map((entry) => ({
          file: entry.file,
          code: entry.code,
          message: entry.message,
          count: entry.count,
        })),
      ]),
  );
  return `${JSON.stringify({ version: 1, workspaces }, null, 2)}\n`;
};

const alwaysFailing = (diagnostics: readonly Diagnostic[]): readonly Diagnostic[] =>
  diagnostics.filter((diagnostic) => missingExportCodeSet.has(diagnostic.code));

const baselinedEntries = (
  baseline: TypecheckBaseline,
  workspace: string,
): readonly CountedDiagnostic[] => baseline.workspaces[workspace] ?? [];

const difference = (
  actual: readonly CountedDiagnostic[],
  expected: readonly CountedDiagnostic[],
): readonly CountedDiagnostic[] => {
  const expectedCounts = new Map(expected.map((entry) => [fingerprintOf(entry), entry.count]));
  return actual.flatMap((entry) => {
    const allowed = expectedCounts.get(fingerprintOf(entry)) ?? 0;
    if (entry.count <= allowed) {
      return [];
    }
    return [{ ...entry, count: entry.count - allowed }];
  });
};

const evaluateTypecheck = (
  workspace: string,
  diagnostics: readonly Diagnostic[],
  baseline: TypecheckBaseline,
): TypecheckVerdict => {
  const alwaysFail = alwaysFailing(diagnostics);
  const countable = countDiagnostics(
    diagnostics.filter((diagnostic) => !missingExportCodeSet.has(diagnostic.code)),
  );
  const expected = countDiagnostics(
    baselinedEntries(baseline, workspace).flatMap((entry) =>
      Array.from({ length: entry.count }, () => ({
        file: entry.file,
        code: entry.code,
        message: entry.message,
      })),
    ),
  );
  const unexpected = difference(countable, expected);
  const leftover = difference(expected, countable);
  return {
    ok: alwaysFail.length === 0 && unexpected.length === 0 && leftover.length === 0,
    alwaysFail,
    unexpected,
    leftover,
  };
};

const snapshotOf = (diagnostics: readonly Diagnostic[]): readonly BaselineEntry[] =>
  countDiagnostics(diagnostics.filter((diagnostic) => !missingExportCodeSet.has(diagnostic.code)));

const formatCounted = (entries: readonly CountedDiagnostic[]): string =>
  entries
    .map((entry) => {
      const times = entry.count === 1 ? "" : ` \u00d7${String(entry.count)}`;
      return `${entry.file}: error ${entry.code}: ${entry.message}${times}`;
    })
    .join("\n");

const formatDiagnostics = (entries: readonly Diagnostic[]): string =>
  entries.map((entry) => `${entry.file}: error ${entry.code}: ${entry.message}`).join("\n");

const formatReport = (verdict: TypecheckVerdict): string => {
  const sections: string[] = [];
  if (verdict.alwaysFail.length > 0) {
    sections.push(
      `typecheck gate: ${String(verdict.alwaysFail.length)} missing-export errors\n${formatDiagnostics(verdict.alwaysFail)}`,
    );
  }
  if (verdict.unexpected.length > 0) {
    sections.push(
      `typecheck gate: ${String(verdict.unexpected.reduce((total, entry) => total + entry.count, 0))} new diagnostics\n${formatCounted(verdict.unexpected)}`,
    );
  }
  if (verdict.leftover.length > 0) {
    sections.push(
      `typecheck gate: ${String(verdict.leftover.reduce((total, entry) => total + entry.count, 0))} baselined diagnostics are gone; rewrite the snapshot\n${formatCounted(verdict.leftover)}`,
    );
  }
  return `${sections.join("\n")}\n`;
};

const printedOutput = (output: string): string => (output.endsWith("\n") ? output : `${output}\n`);

const combinedOutput = (result: {
  readonly status: number | null;
  readonly stderr: string | null;
  readonly stdout: string | null;
}): CompilerResult => ({
  output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  status: result.status ?? 1,
});

const pathWithBins = (): NodeJS.ProcessEnv => {
  const bins = path.join(repositoryRoot, "node_modules/.bin");
  return {
    ...process.env,
    PATH: [bins, process.env["PATH"]]
      .filter((entry) => entry !== undefined && entry !== "")
      .join(path.delimiter),
  };
};

const binRelative = (manifest: { readonly bin?: Readonly<Record<string, string>> }): string => {
  const relative = manifest.bin?.["effect-tsgo"];
  if (relative === undefined) {
    throw new Error("typecheck gate: @effect/tsgo is missing the effect-tsgo bin");
  }
  return relative;
};

const compilerFromResolution = (resolved: {
  readonly status: number | null;
  readonly stderr: string | null;
  readonly stdout: string | null;
}): string => {
  const executable = (resolved.stdout ?? "").trim();
  if (resolved.status !== 0 || executable === "") {
    throw new Error(combinedOutput(resolved).output || "typecheck gate: compiler not found");
  }
  return executable;
};

const effectTsgoBin = (): string => {
  const packageJson = createRequire(import.meta.url).resolve("@effect/tsgo/package.json");
  return path.join(
    path.dirname(packageJson),
    binRelative(
      JSON.parse(readFileSync(packageJson, "utf8")) as {
        readonly bin?: Readonly<Record<string, string>>;
      },
    ),
  );
};

const locateCompiler = (env: NodeJS.ProcessEnv): string =>
  compilerFromResolution(
    spawnSync(process.execPath, [effectTsgoBin(), "get-exe-path"], {
      encoding: "utf8",
      env,
    }),
  );

const compilerOutputLimit = 32 * 1024 * 1024;

const compileWorkspace = (
  cwd: string,
  env: NodeJS.ProcessEnv = pathWithBins(),
  locate: (env: NodeJS.ProcessEnv) => string = locateCompiler,
): CompilerResult => {
  let executable: string;
  try {
    executable = locate(env);
  } catch (error) {
    return {
      output:
        error instanceof Error ? `${error.message}\n` : "typecheck gate: compiler not found\n",
      status: 1,
    };
  }
  return combinedOutput(
    spawnSync(executable, ["--pretty", "false", "--noEmit", "-p", "tsconfig.json"], {
      cwd,
      encoding: "utf8",
      env,
      maxBuffer: compilerOutputLimit,
    }),
  );
};

const runEffectTypecheck = (asked: TypecheckIo): number => {
  const unknown = asked.args.filter((argument) => argument !== writeFlag);
  if (unknown.length > 0) {
    asked.print(`Unknown option ${unknown.join(", ")}.\n`);
    return 1;
  }
  const compiled = asked.compile();
  asked.print(printedOutput(compiled.output));
  const diagnostics = parseTscOutput(compiled.output).map((diagnostic) =>
    portableDiagnostic(diagnostic, asked.repositoryRoot),
  );
  if (diagnostics.length === 0 && compiled.status !== 0) {
    asked.print("typecheck gate: compiler exited without diagnostics\n");
    return 1;
  }
  const workspace = workspaceOf(asked.cwd, asked.repositoryRoot);
  const baseline = portableBaseline(
    parseBaseline(asked.readText(asked.baselinePath)),
    asked.repositoryRoot,
  );
  if (asked.args.includes(writeFlag)) {
    const alwaysFail = alwaysFailing(diagnostics);
    if (alwaysFail.length > 0) {
      asked.print(formatReport({ ok: false, alwaysFail, unexpected: [], leftover: [] }));
      return 1;
    }
    asked.writeText(
      asked.baselinePath,
      serializeBaseline({
        version: 1,
        workspaces: {
          ...baseline.workspaces,
          [workspace]: snapshotOf(diagnostics),
        },
      }),
    );
    return 0;
  }
  const verdict = evaluateTypecheck(workspace, diagnostics, baseline);
  if (!verdict.ok) {
    asked.print(formatReport(verdict));
    return 1;
  }
  return 0;
};

const defaultIo = (asked: {
  readonly cwd: string;
  readonly args: readonly string[];
}): TypecheckIo => ({
  cwd: asked.cwd,
  repositoryRoot,
  args: asked.args,
  baselinePath,
  compile: () => compileWorkspace(asked.cwd),
  readText: (file) => readFileSync(file, "utf8"),
  writeText: (file, text) => {
    writeFileSync(file, text);
  },
  print: (text) => {
    process.stdout.write(text);
  },
});

const startEffectTypecheckCli = (
  asked: {
    readonly cwd: string;
    readonly args: readonly string[];
  } = { cwd: process.cwd(), args: process.argv.slice(2) },
): number => runEffectTypecheck(defaultIo(asked));

const isInvokedAsCli = (argv1: string | undefined, modulePath: string): boolean => {
  if (argv1 === undefined) {
    return false;
  }
  try {
    return realpathSync(argv1) === realpathSync(modulePath);
  } catch {
    return false;
  }
};

const reportCliFailure = (error: unknown): void => {
  process.exitCode = 1;
  process.stderr.write(error instanceof Error ? `${error.message}\n` : "typecheck gate failed\n");
};

const invokedCode = (start: () => number): number => {
  try {
    const code = start();
    process.exitCode = code;
    return code;
  } catch (error) {
    reportCliFailure(error);
    return 1;
  }
};

const runInvokedCli = (start: () => number = startEffectTypecheckCli): void => {
  invokedCode(start);
};

const maybeStart = (argv1: string | undefined, modulePath: string): boolean => {
  if (!isInvokedAsCli(argv1, modulePath)) {
    return false;
  }
  runInvokedCli();
  return true;
};

const exitAfterFlush = (
  code: number,
  exit: (code: number) => void,
  streams: readonly NodeJS.WritableStream[],
): void => {
  const pending: NodeJS.WritableStream[] = [];
  for (const stream of streams) {
    if (stream.writable) {
      pending.push(stream);
    }
  }
  if (pending.length === 0) {
    exit(code);
    return;
  }
  let remaining = pending.length;
  const step = (): void => {
    remaining -= 1;
    if (remaining === 0) {
      exit(code);
    }
  };
  for (const stream of pending) {
    stream.write("", step);
  }
};

const exitInvokedCli = (
  argv1: string | undefined,
  modulePath: string,
  start: () => number = startEffectTypecheckCli,
  exit: (code: number) => void = process.exit,
  streams: readonly NodeJS.WritableStream[] = [process.stdout, process.stderr],
): boolean => {
  if (!isInvokedAsCli(argv1, modulePath)) {
    return false;
  }
  exitAfterFlush(invokedCode(start), exit, streams);
  return true;
};

exitInvokedCli(process.argv[1], fileURLToPath(import.meta.url));

export {
  binRelative,
  combinedOutput,
  compileWorkspace,
  compilerFromResolution,
  diagnosticOf,
  effectTsgoBin,
  evaluateTypecheck,
  isInvokedAsCli,
  locateCompiler,
  exitAfterFlush,
  exitInvokedCli,
  maybeStart,
  missingExportCodes,
  parseBaseline,
  parseTscOutput,
  reportCliFailure,
  runEffectTypecheck,
  runInvokedCli,
  serializeBaseline,
  startEffectTypecheckCli,
  workspaceOf,
  writeFlag,
};
export type {
  BaselineEntry,
  CompilerResult,
  CountedDiagnostic,
  Diagnostic,
  MissingExportCode,
  TypecheckBaseline,
  TypecheckIo,
  TypecheckVerdict,
};
