import { Effect, Schema } from "effect";
import { attempt, uniqBy, zip } from "es-toolkit";

import { posixPath } from "../platform/path.ts";
import { failingWhenThrown } from "./expected-throw.ts";
import { runGitBuffer, runGitText } from "./git-text.ts";
import {
  DiffUnreadable,
  parseRepositoryChanges,
  type RepositoryChange,
} from "./repository-diff.ts";

type CompareRevisionsOptions = Readonly<{
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

export type Side = "base" | "head";

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
  SOURCE_EXTENSIONS.includes(posixPath.extname(sourcePath).toLowerCase());

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
          UndecodableSource.make({
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
  "--src-prefix=a/",
  "--dst-prefix=b/",
  "--find-renames",
  "--no-ext-diff",
  "--no-color",
  "--no-textconv",
  ...presentation,
  baseObject,
  headObject,
  "--",
];

type RawInventory = Readonly<{
  inventoryOutput: string;
  objectAt: ReadonlyMap<string, string>;
}>;

const RAW_RECORD_HEADER =
  /^:\d{6} \d{6} ([\da-f]{40}(?:[\da-f]{24})?) ([\da-f]{40}(?:[\da-f]{24})?) ([A-Z]\d{0,3})$/u;

type RawRecord = Readonly<{
  beforeObject: string;
  afterObject: string;
  beforePath: string;
  afterPath: string;
  status: string;
  recordPaths: readonly string[];
}>;

type RawHeader = Readonly<{ beforeObject: string; afterObject: string; status: string }>;

const rawHeaderOf = (field: string | undefined): RawHeader | undefined => {
  const [, beforeObject, afterObject, status] = RAW_RECORD_HEADER.exec(field ?? "") ?? [];
  return status === undefined || beforeObject === undefined || afterObject === undefined
    ? undefined
    : { beforeObject, afterObject, status };
};

const rawRecordAt = (fields: readonly string[], index: number): RawRecord | undefined => {
  const header = rawHeaderOf(fields[index]);
  if (header === undefined) return undefined;
  const pathCount = header.status.startsWith("R") ? 2 : 1;
  const recordPaths = fields.slice(index + 1, index + 1 + pathCount);
  const [beforePath, afterPath = beforePath] = recordPaths;
  if (beforePath === undefined || afterPath === undefined || recordPaths.length !== pathCount) {
    return undefined;
  }
  return { ...header, beforePath, afterPath, recordPaths };
};

const rawInventoryOf = (rawOutput: string): Effect.Effect<RawInventory, DiffUnreadable> =>
  Effect.suspend(() => {
    const fields = rawOutput.split("\0");
    const unreadableRecord = DiffUnreadable.make({ message: "Invalid NUL-delimited Git raw diff" });
    if (fields.pop() !== "") return Effect.fail(unreadableRecord);
    const records: string[] = [];
    const objectAt = new Map<string, string>();
    let index = 0;
    while (index < fields.length) {
      const record = rawRecordAt(fields, index);
      if (record === undefined) {
        return Effect.fail(unreadableRecord);
      }
      objectAt.set(
        requestKey({ side: "base", sourcePath: record.beforePath }),
        record.beforeObject,
      );
      objectAt.set(requestKey({ side: "head", sourcePath: record.afterPath }), record.afterObject);
      records.push([record.status, ...record.recordPaths, ""].join("\0"));
      index += 1 + record.recordPaths.length;
    }
    return Effect.succeed({ inventoryOutput: records.join(""), objectAt });
  });

type RequestedBlob = Readonly<{ objectName: string; blobObject: string }>;

const LINE_FEED = 10;

const batchedBlobs = (
  output: Uint8Array,
  requestedBlobs: readonly RequestedBlob[],
): Effect.Effect<readonly Uint8Array[], BlobUnreadable> =>
  Effect.suspend(() => {
    const blobs: Uint8Array[] = [];
    const headerDecoder = new TextDecoder("utf-8");
    let offset = 0;
    for (const { objectName, blobObject } of requestedBlobs) {
      const headerEnd = output.indexOf(LINE_FEED, offset);
      const [answeredObject, type, size] =
        headerEnd === -1 ? [] : headerDecoder.decode(output.subarray(offset, headerEnd)).split(" ");
      const length = Number(size);
      const contentEnd = headerEnd + 1 + length;
      if (
        answeredObject !== blobObject ||
        type !== "blob" ||
        !Number.isSafeInteger(length) ||
        output[contentEnd] !== LINE_FEED
      ) {
        return Effect.fail(BlobUnreadable.make({ message: `Git holds no blob at ${objectName}` }));
      }
      blobs.push(output.subarray(headerEnd + 1, contentEnd));
      offset = contentEnd + 1;
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
  const [rawOutput, diff] = yield* Effect.all(
    [
      runGitText({
        repositoryRoot,
        args: diffArguments({
          baseObject,
          headObject,
          presentation: ["--raw", "--no-abbrev", "-z"],
        }),
      }),
      runGitText({
        repositoryRoot,
        args: diffArguments({ baseObject, headObject, presentation: ["--unified=0"] }),
      }),
    ],
    { concurrency: "unbounded" },
  );
  const { inventoryOutput, objectAt } = yield* rawInventoryOf(rawOutput);
  const requestedBlobOf = (
    request: SourceRequest,
  ): Effect.Effect<RequestedBlob, BlobUnreadable> => {
    const objectName = `${request.side === "base" ? baseObject : headObject}:${request.sourcePath}`;
    const blobObject = objectAt.get(requestKey(request));
    return blobObject === undefined
      ? Effect.fail(BlobUnreadable.make({ message: `Git diff lists no object at ${objectName}` }))
      : Effect.succeed({ objectName, blobObject });
  };
  const readBlobs = (requests: readonly SourceRequest[]) => {
    if (requests.length === 0) return Effect.succeed([]);
    return Effect.flatMap(Effect.forEach(requests, requestedBlobOf), (requestedBlobs) =>
      Effect.flatMap(
        runGitBuffer({
          repositoryRoot,
          args: ["cat-file", "--batch"],
          input: new TextEncoder().encode(
            requestedBlobs.map(({ blobObject }) => `${blobObject}\n`).join(""),
          ),
        }),
        (output) => batchedBlobs(output, requestedBlobs),
      ),
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
export type {
  AddedComparisonFile,
  ChangedComparisonFile,
  DeletedComparisonFile,
  RenamedComparisonFile,
};
