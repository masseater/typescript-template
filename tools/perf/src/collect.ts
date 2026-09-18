import { Effect, Option, Schema } from "effect";
import type { Executables, RootRun } from "./spans.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, readdir, stat } from "node:fs/promises";
import type { ProcessRecord } from "./protocol.ts";
import { decodeSummary } from "./summary.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { processRecordSuffix } from "./protocol.ts";

interface CollectedRun {
  readonly executables: Executables;
  readonly records: readonly ProcessRecord[];
  readonly summary: RootRun["summary"];
  readonly unreadableProcesses: number;
}

const PACKAGE_MARKER = "/node_modules/";
const SCOPED_PACKAGE_DEPTH = 2;
const SCRIPT_INDEX = 1;
const root = path.resolve(import.meta.dirname, "../../..");
const summaryDirectory = path.join(root, "node_modules/.vite/task-cache");
const ProcessRecordJson = Schema.fromJsonString(
  Schema.Struct({
    argv: Schema.Array(Schema.String),
    cpuSystemMilliseconds: Schema.Number,
    cpuUserMilliseconds: Schema.Number,
    cwd: Schema.String,
    endMilliseconds: Schema.Number,
    exitCode: Schema.Number,
    maxRssKilobytes: Schema.Number,
    parentSource: Schema.Literals(["environment", "process"]),
    parentSpanId: Schema.String,
    pid: Schema.Number,
    ppid: Schema.Number,
    spanId: Schema.String,
    startMilliseconds: Schema.Number,
    traceId: Schema.String,
  }),
);
const UnknownJson = Schema.fromJsonString(Schema.Unknown);
const PackageBin = Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.String)]);
const PackageJson = Schema.fromJsonString(
  Schema.Struct({ bin: Schema.optionalKey(PackageBin), name: Schema.String }),
);

function readJson<Decoded>(
  schema: Schema.Codec<Decoded, string>,
  file: string,
): Effect.Effect<Option.Option<Decoded>> {
  return Effect.tryPromise(async () => readFile(file, "utf-8")).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.option,
  );
}

function processRecords(
  directory: string,
): Effect.Effect<Pick<CollectedRun, "records" | "unreadableProcesses">> {
  return Effect.promise(async () => readdir(directory)).pipe(
    Effect.flatMap((names) =>
      Effect.forEach(
        names.filter((name) => name.endsWith(processRecordSuffix)),
        (name) => readJson(ProcessRecordJson, path.join(directory, name)),
      ),
    ),
    Effect.map((results) => ({
      records: results.flatMap((result) => Option.toArray(result)),
      unreadableProcesses: results.filter((result) => Option.isNone(result)).length,
    })),
  );
}

function modifiedAt(file: string): Effect.Effect<number> {
  return Effect.tryPromise(async () => stat(file)).pipe(
    Effect.map((stats) => stats.mtimeMs),
    Effect.orElseSucceed(() => 0),
  );
}

function latestSummary(since: number): Effect.Effect<string | undefined> {
  return Effect.tryPromise(async () => readdir(summaryDirectory)).pipe(
    Effect.orElseSucceed((): readonly string[] => []),
    Effect.flatMap((versions) =>
      Effect.forEach(versions, (version) => {
        const file = path.join(summaryDirectory, version, "last-summary.json");
        return Effect.map(modifiedAt(file), (modified) => ({ file, modified }));
      }),
    ),
    Effect.map(
      (candidates) =>
        candidates
          .filter((candidate) => candidate.modified >= since)
          .toSorted((left, right) => right.modified - left.modified)[0]?.file,
    ),
  );
}

function readSummary(file: string): Effect.Effect<RootRun["summary"]> {
  return readJson(UnknownJson, file).pipe(
    Effect.map((json) =>
      Option.match(Option.flatMap(json, decodeSummary), {
        onNone: (): RootRun["summary"] => ({ state: "unreadable", tasks: [] }),
        onSome: (tasks): RootRun["summary"] => ({ state: "read", tasks }),
      }),
    ),
  );
}

function runSummary(since: number): Effect.Effect<RootRun["summary"]> {
  return latestSummary(since).pipe(
    Effect.flatMap((file) =>
      file === undefined
        ? Effect.succeed({ state: "absent", tasks: [] } as const)
        : readSummary(file),
    ),
  );
}

function packageDirectory(script: string): string | undefined {
  const index = script.lastIndexOf(PACKAGE_MARKER);
  if (index === -1) {
    return undefined;
  }
  const start = index + PACKAGE_MARKER.length;
  const segments = script.slice(start).split("/");
  const depth = segments[0]?.startsWith("@") === true ? SCOPED_PACKAGE_DEPTH : 1;
  return script.slice(0, start) + segments.slice(0, depth).join("/");
}

function declaredBins(manifest: typeof PackageJson.Type): Readonly<Record<string, string>> {
  const { bin, name } = manifest;
  return typeof bin === "string" ? { [name.replace(/^@[^/]+\//u, "")]: bin } : (bin ?? {});
}

function binName(script: string): Effect.Effect<Option.Option<readonly [string, string]>> {
  const directory = packageDirectory(script);
  if (directory === undefined) {
    return Effect.succeed(Option.none());
  }
  return readJson(PackageJson, path.join(directory, "package.json")).pipe(
    Effect.map((manifest) =>
      Option.flatMap(manifest, (found) =>
        Option.fromUndefinedOr(
          Object.entries(declaredBins(found)).find(
            ([, target]) => path.resolve(directory, target) === script,
          ),
        ),
      ),
    ),
    Effect.map((bin) => Option.map(bin, ([name]) => [script, name] as const)),
  );
}

function executables(records: readonly ProcessRecord[]): Effect.Effect<Executables> {
  const scripts = [
    ...new Set(records.flatMap(({ argv }) => argv.slice(SCRIPT_INDEX, SCRIPT_INDEX + 1))),
  ];
  return Effect.forEach(scripts, binName).pipe(
    Effect.map((found) => new Map(found.flatMap((entry) => Option.toArray(entry)))),
  );
}

const collectRun = Effect.fn("collectRun")(function* collectRun(directory: string, since: number) {
  const [processes, summary] = yield* Effect.all([processRecords(directory), runSummary(since)]);
  const collected: CollectedRun = {
    ...processes,
    executables: yield* executables(processes.records),
    summary,
  };
  return collected;
});

export { collectRun, root };
