import { Effect, Schema } from "effect";
import { attempt, uniqBy, zip } from "es-toolkit";

import { failingWhenThrown } from "./expected-throw.ts";
import { gitPath } from "./git-path.ts";
import { runGitBuffer, runGitText } from "./git-text.ts";
import {
  DiffUnreadable,
  parseRepositoryChanges,
  type RepositoryChange,
} from "./repository-diff.ts";

export type CompareRevisionsOptions = Readonly<{
  repositoryRoot: string;
  baseRevision: string;
  headRevision: string;
}>;

type AddedComparisonFile = Readonly<{
  kind: "added";
  beforePath: null;
  afterPath: string;
  beforeSource: null;
  afterSource: string | null;
  addedLines: readonly number[];
  firstAddedLine: number | null;
}>;

type DeletedComparisonFile = Readonly<{
  kind: "deleted";
  beforePath: string;
  afterPath: null;
  beforeSource: string | null;
  afterSource: null;
  addedLines: readonly number[];
  firstAddedLine: null;
}>;

type ChangedComparisonFile = Readonly<{
  kind: "changed";
  beforePath: string;
  afterPath: string;
  beforeSource: string | null;
  afterSource: string | null;
  addedLines: readonly number[];
  firstAddedLine: number | null;
}>;

type RenamedComparisonFile = Readonly<{
  kind: "renamed";
  beforePath: string;
  afterPath: string;
  beforeSource: string | null;
  afterSource: string | null;
  addedLines: readonly number[];
  firstAddedLine: number | null;
}>;

export type ComparisonFile =
  | AddedComparisonFile
  | DeletedComparisonFile
  | ChangedComparisonFile
  | RenamedComparisonFile;

export type RepositoryComparison = Readonly<{
  repositoryRoot: string;
  baseRevision: string;
  headRevision: string;
  files: readonly ComparisonFile[];
}>;

export class UndecodableSource extends Schema.TaggedError<UndecodableSource>()(
  "UndecodableSource",
  { message: Schema.String, cause: Schema.Defect() },
) {}

export class BlobUnreadable extends Schema.TaggedError<BlobUnreadable>()("BlobUnreadable", {
  message: Schema.String,
}) {}

type Side = "base" | "head";

export type SourceRequest = Readonly<{ side: Side; sourcePath: string }>;

export type SourceReader<E, R> = (
  requests: readonly SourceRequest[],
) => Effect.Effect<readonly Uint8Array[], E, R>;

const SOURCE_EXTENSIONS: readonly string[] = [
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
];

const isSource = (sourcePath: string): boolean =>
  SOURCE_EXTENSIONS.includes(gitPath.extname(sourcePath).toLowerCase());

const utf8SourceOf = (sourceBytes: Uint8Array): string | null => {
  const [undecodable, decoded] = attempt<string, Error>(() =>
    new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes),
  );
  return undecodable === null ? decoded : null;
};

const decodedSource = (
  { side, sourcePath }: SourceRequest,
  sourceBytes: Uint8Array,
): Effect.Effect<string | null, UndecodableSource> =>
  side === "base"
    ? Effect.succeed(utf8SourceOf(sourceBytes))
    : Effect.try({
        try: () => new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes),
        catch: (cause) =>
          new UndecodableSource({
            message: `Source blob does not decode as UTF-8: ${sourcePath}`,
            cause,
          }),
      });

const requestKey = ({ side, sourcePath }: SourceRequest): string => `${side}\0${sourcePath}`;

const sourceRequestsOf = (change: RepositoryChange): readonly SourceRequest[] => [
  ...(change.beforePath !== null && isSource(change.beforePath)
    ? [{ side: "base" as const, sourcePath: change.beforePath }]
    : []),
  ...(change.afterPath !== null && isSource(change.afterPath)
    ? [{ side: "head" as const, sourcePath: change.afterPath }]
    : []),
];

const comparisonFileFor = (
  change: RepositoryChange,
  sourceAt: (side: Side, sourcePath: string) => string | null,
): ComparisonFile => {
  switch (change.kind) {
    case "added":
      return {
        ...change,
        beforeSource: null,
        afterSource: sourceAt("head", change.afterPath),
        firstAddedLine: change.addedLines[0] ?? null,
      };
    case "deleted":
      return {
        ...change,
        beforeSource: sourceAt("base", change.beforePath),
        afterSource: null,
        firstAddedLine: null,
      };
    case "changed":
    case "renamed":
      return {
        ...change,
        beforeSource: sourceAt("base", change.beforePath),
        afterSource: sourceAt("head", change.afterPath),
        firstAddedLine: change.addedLines[0] ?? null,
      };
  }
};

export const comparisonFrom = <E, R>({
  inventoryOutput,
  diff,
  readSources,
}: Readonly<{
  inventoryOutput: string;
  diff: string;
  readSources: SourceReader<E, R>;
}>): Effect.Effect<readonly ComparisonFile[], E | DiffUnreadable | UndecodableSource, R> =>
  Effect.gen(function* comparisonFrom() {
    const changes = yield* failingWhenThrown(
      () => parseRepositoryChanges({ inventoryOutput, diff }),
      Schema.is(DiffUnreadable),
    );
    const requests = uniqBy(changes.flatMap(sourceRequestsOf), requestKey);
    const blobs = yield* readSources(requests);
    const sources = new Map(
      yield* Effect.forEach(zip(requests, blobs), ([request, sourceBytes]) =>
        Effect.map(
          decodedSource(request, sourceBytes),
          (source) => [requestKey(request), source] as const,
        ),
      ),
    );
    const sourceAt = (side: Side, sourcePath: string): string | null => {
      if (!isSource(sourcePath)) return null;
      const request = { side, sourcePath };
      const source = sources.get(requestKey(request));
      if (source === undefined) throw new Error(`No source was read for ${side}:${sourcePath}`);
      return source;
    };
    return changes.map((change) => comparisonFileFor(change, sourceAt));
  });

const resolveRevisionObject = (repositoryRoot: string, revision: string) =>
  Effect.map(
    runGitText({
      repositoryRoot,
      args: ["rev-parse", "--verify", "--end-of-options", `${revision}^{tree}`],
    }),
    (answered) => answered.trim(),
  );

const diffArguments = ({
  baseObject,
  headObject,
  presentation,
}: Readonly<{
  baseObject: string;
  headObject: string;
  presentation: readonly string[];
}>): readonly string[] => [
  "-c",
  "core.quotePath=false",
  "-c",
  "diff.renameLimit=0",
  "diff",
  "--default-prefix",
  "--find-renames",
  "--no-ext-diff",
  "--no-color",
  "--no-textconv",
  ...presentation,
  baseObject,
  headObject,
  "--",
];

const NUL = 0;

const indexAfter = (bytes: Uint8Array, from: number, wanted: number): number => {
  const found = bytes.indexOf(wanted, from);
  return found === -1 ? bytes.length : found;
};

const batchedBlobs = (
  output: Uint8Array,
  objectNames: readonly string[],
): Effect.Effect<readonly Uint8Array[], BlobUnreadable> =>
  Effect.suspend(() => {
    const blobs: Uint8Array[] = [];
    const headerDecoder = new TextDecoder("utf-8");
    let offset = 0;
    for (const objectName of objectNames) {
      const headerEnd = indexAfter(output, offset, NUL);
      const [, type, size] = headerDecoder.decode(output.subarray(offset, headerEnd)).split(" ");
      const length = Number(size);
      if (type !== "blob" || !Number.isSafeInteger(length)) {
        return Effect.fail(new BlobUnreadable({ message: `Git holds no blob at ${objectName}` }));
      }
      blobs.push(output.subarray(headerEnd + 1, headerEnd + 1 + length));
      offset = headerEnd + 1 + length + 1;
    }
    return Effect.succeed(blobs);
  });
export const compareRevisions = Effect.fn("compareRevisions")(function* compareRevisions({
  repositoryRoot,
  baseRevision,
  headRevision,
}: CompareRevisionsOptions) {
  const [baseObject, headObject] = yield* Effect.all(
    [
      resolveRevisionObject(repositoryRoot, baseRevision),
      resolveRevisionObject(repositoryRoot, headRevision),
    ],
    { concurrency: "unbounded" },
  );
  const [inventoryOutput, diff] = yield* Effect.all(
    [
      runGitText({
        repositoryRoot,
        args: diffArguments({ baseObject, headObject, presentation: ["--name-status", "-z"] }),
      }),
      runGitText({
        repositoryRoot,
        args: diffArguments({ baseObject, headObject, presentation: ["--unified=0"] }),
      }),
    ],
    { concurrency: "unbounded" },
  );
  const readBlobs = (requests: readonly SourceRequest[]) => {
    if (requests.length === 0) return Effect.succeed([]);
    const objectNames = requests.map(
      ({ side, sourcePath }) => `${side === "base" ? baseObject : headObject}:${sourcePath}`,
    );
    return Effect.flatMap(
      runGitBuffer({
        repositoryRoot,
        args: ["cat-file", "--batch", "-Z"],
        input: new TextEncoder().encode(
          objectNames.map((objectName) => `${objectName}\0`).join(""),
        ),
      }),
      (output) => batchedBlobs(output, objectNames),
    );
  };

  const comparison: RepositoryComparison = {
    repositoryRoot,
    baseRevision,
    headRevision,
    files: yield* comparisonFrom({ inventoryOutput, diff, readSources: readBlobs }),
  };
  return comparison;
});
