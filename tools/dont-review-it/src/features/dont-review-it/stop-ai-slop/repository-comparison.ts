import { Effect, Schema } from "effect";
import { attempt } from "es-toolkit";

import { path } from "../platform/path.ts";
import { runGitBuffer, runGitText } from "./git-text.ts";
import { parsingRefused, type ParsingRefused } from "./parsing-refused.ts";
import { parseRepositoryChanges, type RepositoryChange } from "./repository-diff.ts";

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
  { message: Schema.String },
) {}

const resolveRevisionObject = (repositoryRoot: string, revision: string) =>
  Effect.map(
    runGitText({
      repositoryRoot,
      args: ["rev-parse", "--verify", "--end-of-options", `${revision}^{tree}`],
    }),
    (answered) => answered.trim(),
  );

const utf8SourceOf = (sourceBytes: Uint8Array): string | null => {
  const [undecodable, decoded] = attempt<string, Error>(() =>
    new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes),
  );
  return undecodable === null ? decoded : null;
};

export const decodedSource = (
  sourcePath: string,
  sourceBytes: Uint8Array,
): Effect.Effect<string, UndecodableSource> => {
  const decoded = utf8SourceOf(sourceBytes);
  return decoded === null
    ? Effect.fail(
        new UndecodableSource({ message: `Source blob does not decode as UTF-8: ${sourcePath}` }),
      )
    : Effect.succeed(decoded);
};

export const decodedPreviousSource = (sourceBytes: Uint8Array): string | null =>
  utf8SourceOf(sourceBytes);

export type SideSources<E, R> = Readonly<{
  base: (sourcePath: string) => Effect.Effect<string | null, E, R>;
  head: (sourcePath: string) => Effect.Effect<string | null, E, R>;
}>;

const sourceExtensions = [".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"];

const readSource = <E, R>({
  sources,
  side,
  sourcePath,
}: Readonly<{
  sources: SideSources<E, R>;
  side: keyof SideSources<E, R>;
  sourcePath: string;
}>): Effect.Effect<string | null, E, R> =>
  sourceExtensions.includes(path.extname(sourcePath).toLowerCase())
    ? sources[side](sourcePath)
    : Effect.succeed(null);

type FileConversionInput<File extends RepositoryChange, E, R> = Readonly<{
  sources: SideSources<E, R>;
  file: File;
}>;

const toAddedComparisonFile = <E, R>({
  sources,
  file,
}: FileConversionInput<Extract<RepositoryChange, { kind: "added" }>, E, R>): Effect.Effect<
  AddedComparisonFile,
  E,
  R
> =>
  Effect.map(readSource({ sources, side: "head", sourcePath: file.afterPath }), (afterSource) => ({
    ...file,
    beforeSource: null,
    afterSource,
    firstAddedLine: file.addedLines[0] ?? null,
  }));

const toDeletedComparisonFile = <E, R>({
  sources,
  file,
}: FileConversionInput<Extract<RepositoryChange, { kind: "deleted" }>, E, R>): Effect.Effect<
  DeletedComparisonFile,
  E,
  R
> =>
  Effect.map(
    readSource({ sources, side: "base", sourcePath: file.beforePath }),
    (beforeSource) => ({
      ...file,
      beforeSource,
      afterSource: null,
      firstAddedLine: null,
    }),
  );

const toTwoSidedComparisonFile = <E, R>({
  sources,
  file,
}: FileConversionInput<
  Extract<RepositoryChange, { kind: "changed" | "renamed" }>,
  E,
  R
>): Effect.Effect<ChangedComparisonFile | RenamedComparisonFile, E, R> =>
  Effect.map(
    Effect.all(
      [
        readSource({ sources, side: "base", sourcePath: file.beforePath }),
        readSource({ sources, side: "head", sourcePath: file.afterPath }),
      ],
      { concurrency: "unbounded" },
    ),
    ([beforeSource, afterSource]) => ({
      ...file,
      beforeSource,
      afterSource,
      firstAddedLine: file.addedLines[0] ?? null,
    }),
  );

const toComparisonFile = <E, R>({
  sources,
  file,
}: FileConversionInput<RepositoryChange, E, R>): Effect.Effect<ComparisonFile, E, R> => {
  switch (file.kind) {
    case "added":
      return toAddedComparisonFile({ sources, file });
    case "deleted":
      return toDeletedComparisonFile({ sources, file });
    case "changed":
    case "renamed":
      return toTwoSidedComparisonFile({ sources, file });
  }
};

export const comparisonFrom = <E, R>({
  inventoryOutput,
  diff,
  sources,
}: Readonly<{
  inventoryOutput: string;
  diff: string;
  sources: SideSources<E, R>;
}>): Effect.Effect<readonly ComparisonFile[], E | ParsingRefused, R> =>
  Effect.flatMap(
    Effect.try({
      try: () => parseRepositoryChanges({ inventoryOutput, diff }),
      catch: parsingRefused,
    }),
    (changes) =>
      Effect.forEach(changes, (file) => toComparisonFile({ sources, file }), {
        concurrency: "unbounded",
      }),
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
  const blobAt =
    (
      revision: string,
      decode: (
        sourcePath: string,
        sourceBytes: Uint8Array,
      ) => Effect.Effect<string | null, UndecodableSource>,
    ) =>
    (sourcePath: string) =>
      Effect.flatMap(
        runGitBuffer({ repositoryRoot, args: ["cat-file", "blob", `${revision}:${sourcePath}`] }),
        (sourceBytes) => decode(sourcePath, sourceBytes),
      );

  const comparison: RepositoryComparison = {
    repositoryRoot,
    baseRevision,
    headRevision,
    files: yield* comparisonFrom({
      inventoryOutput,
      diff,
      sources: {
        base: blobAt(baseObject, (_sourcePath, sourceBytes) =>
          Effect.succeed(decodedPreviousSource(sourceBytes)),
        ),
        head: blobAt(headObject, decodedSource),
      },
    }),
  };
  return comparison;
});
