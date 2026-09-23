import { Effect, Option, Schema } from "effect";
import { isPlainObject } from "es-toolkit";

import { parsingRefused, type ParsingRefused } from "./parsing-refused.ts";
import {
  comparisonFrom,
  decodedPreviousSource,
  decodedSource,
  type RepositoryComparison,
  type UndecodableSource,
} from "./repository-comparison.ts";

export class GitHubRequestFailed extends Schema.TaggedError<GitHubRequestFailed>()(
  "GitHubRequestFailed",
  { message: Schema.String, cause: Schema.optional(Schema.Defect()) },
) {}

export type GitHubRequest = (requestPath: string) => Effect.Effect<unknown, GitHubRequestFailed>;

export type GitHubPullRequestComparison = Readonly<{
  repositoryRoot: string;
  repository: string;
  baseRevision: string;
  headRevision: string;
  request: GitHubRequest;
}>;

type ComparedFile = Readonly<{
  filename: string;
  status: string;
  previous_filename?: string | undefined;
  patch?: string | undefined;
}>;

type PlacedFile = Readonly<{
  filename: string;
  formerPath: string;
  patch: string | undefined;
}>;

const refused = (message: string): Effect.Effect<never, ParsingRefused> =>
  Effect.fail(parsingRefused(message));

const movedFrom = (file: ComparedFile): Effect.Effect<string, ParsingRefused> => {
  const before = file.previous_filename;
  return before === undefined || before === ""
    ? refused(`Do not read a move the compare answered without its former path: ${file.filename}.`)
    : Effect.succeed(before);
};

const inPlace = (file: ComparedFile): Effect.Effect<string, ParsingRefused> =>
  Effect.succeed(file.filename);

type ChangeShape = Readonly<{
  formerPath: (file: ComparedFile) => Effect.Effect<string, ParsingRefused>;
  inventory: (file: PlacedFile) => string;
  headers: (file: PlacedFile) => readonly string[];
}>;

const asAdded: ChangeShape = {
  formerPath: inPlace,
  inventory: (file) => `A\0${file.filename}\0`,
  headers: (file) => ["new file mode 100644", "--- /dev/null", `+++ b/${file.filename}`],
};

const asModified: ChangeShape = {
  formerPath: inPlace,
  inventory: (file) => `M\0${file.filename}\0`,
  headers: (file) => [`--- a/${file.filename}`, `+++ b/${file.filename}`],
};

const SHAPES_BY_STATUS: Readonly<Record<string, ChangeShape>> = {
  added: asAdded,
  changed: asModified,
  copied: asAdded,
  modified: asModified,
  removed: {
    formerPath: inPlace,
    inventory: (file) => `D\0${file.filename}\0`,
    headers: (file) => ["deleted file mode 100644", `--- a/${file.filename}`, "+++ /dev/null"],
  },
  renamed: {
    formerPath: movedFrom,
    inventory: (file) => `R100\0${file.formerPath}\0${file.filename}\0`,
    headers: (file) => [
      "similarity index 100%",
      `rename from ${file.formerPath}`,
      `rename to ${file.filename}`,
    ],
  },
};

const shapeOf = (file: ComparedFile): Effect.Effect<ChangeShape, ParsingRefused> => {
  const shape = SHAPES_BY_STATUS[file.status];
  return shape === undefined
    ? refused(`Do not read past an unknown compare status "${file.status}".`)
    : Effect.succeed(shape);
};

const patchEntryOf = (shape: ChangeShape, file: PlacedFile): string => {
  const lines = [
    `diff --git a/${file.formerPath} b/${file.filename}`,
    ...shape.headers(file),
    ...(file.patch === undefined ? [] : [file.patch.replace(/\n+$/u, "")]),
  ];
  return `${lines.join("\n")}\n`;
};

const entriesOf = Effect.fn("entriesOf")(function* entriesOf(file: ComparedFile) {
  const shape = yield* shapeOf(file);
  const placed: PlacedFile = {
    filename: file.filename,
    formerPath: yield* shape.formerPath(file),
    patch: file.patch,
  };
  return { inventory: shape.inventory(placed), patch: patchEntryOf(shape, placed) };
});

const fieldsFrom = (
  held: unknown,
  refusal: string,
): Effect.Effect<Readonly<Record<string, unknown>>, ParsingRefused> =>
  isPlainObject(held) ? Effect.succeed(held) : refused(refusal);

const textFrom = (held: unknown, refusal: string): Effect.Effect<string, ParsingRefused> =>
  typeof held === "string" ? Effect.succeed(held) : refused(refusal);

const optionalTextFrom = (
  held: unknown,
  refusal: string,
): Effect.Effect<Option.Option<string>, ParsingRefused> =>
  held === undefined ? Effect.succeedNone : Effect.asSome(textFrom(held, refusal));

const comparedFileFrom = Effect.fn("comparedFileFrom")(function* comparedFileFrom(held: unknown) {
  const fileFields = yield* fieldsFrom(
    held,
    "Do not read a changed file the compare answered as something other than an object.",
  );
  const comparedFile: ComparedFile = {
    filename: yield* textFrom(
      fileFields.filename,
      "Do not read a changed file the compare answered without a path.",
    ),
    status: yield* textFrom(
      fileFields.status,
      "Do not read a changed file the compare answered without a status.",
    ),
    previous_filename: Option.getOrUndefined(
      yield* optionalTextFrom(
        fileFields.previous_filename,
        "Do not read a former path the compare answered as something other than text.",
      ),
    ),
    patch: Option.getOrUndefined(
      yield* optionalTextFrom(
        fileFields.patch,
        "Do not read a patch the compare answered as something other than text.",
      ),
    ),
  };
  return comparedFile;
});

const comparedFilesFrom = (
  held: unknown,
): Effect.Effect<readonly ComparedFile[], ParsingRefused> =>
  Array.isArray(held)
    ? Effect.forEach(held, comparedFileFrom)
    : refused("Do not read the changed files the compare answered as something other than a list.");

const comparedFrom = Effect.fn("comparedFrom")(function* comparedFrom(carried: unknown) {
  const compareFields = yield* fieldsFrom(
    carried,
    "Do not read a compare the API answered as something other than an object.",
  );
  const mergeBaseFields = yield* fieldsFrom(
    compareFields.merge_base_commit,
    "Do not read a compare the API answered without its merge base commit.",
  );
  const changedFiles = compareFields.files;
  return {
    mergeBaseRevision: yield* textFrom(
      mergeBaseFields.sha,
      "Do not read a merge base commit the compare answered without a revision.",
    ),
    files: changedFiles === undefined ? [] : yield* comparedFilesFrom(changedFiles),
  };
});

const decodedContent = (carried: unknown): Effect.Effect<Uint8Array, ParsingRefused> =>
  Effect.flatMap(
    fieldsFrom(
      carried,
      "Do not read a file the contents API answered as something other than an object.",
    ),
    (contentsFields) =>
      Effect.map(
        textFrom(
          contentsFields.content,
          "Do not read a file the contents API answered without content.",
        ),
        (content) => Buffer.from(content, "base64"),
      ),
  );

export const compareGitHubPullRequest = Effect.fn("compareGitHubPullRequest")(
  function* compareGitHubPullRequest({
    repositoryRoot,
    repository,
    baseRevision,
    headRevision,
    request,
  }: GitHubPullRequestComparison) {
    const { mergeBaseRevision, files } = yield* comparedFrom(
      yield* request(`/repos/${repository}/compare/${baseRevision}...${headRevision}`),
    );
    const entries = yield* Effect.forEach(files, entriesOf);
    const contentsAt =
      (
        revision: string,
        decode: (
          sourcePath: string,
          sourceBytes: Uint8Array,
        ) => Effect.Effect<string | null, UndecodableSource>,
      ) =>
      (sourcePath: string) =>
        request(`/repos/${repository}/contents/${encodeURI(sourcePath)}?ref=${revision}`).pipe(
          Effect.flatMap(decodedContent),
          Effect.flatMap((sourceBytes) => decode(sourcePath, sourceBytes)),
        );

    const comparison: RepositoryComparison = {
      repositoryRoot,
      baseRevision: mergeBaseRevision,
      headRevision,
      files: yield* comparisonFrom({
        inventoryOutput: entries.map((entry) => entry.inventory).join(""),
        diff: entries.map((entry) => entry.patch).join(""),
        sources: {
          base: contentsAt(mergeBaseRevision, (_sourcePath, sourceBytes) =>
            Effect.succeed(decodedPreviousSource(sourceBytes)),
          ),
          head: contentsAt(headRevision, decodedSource),
        },
      }),
    };
    return comparison;
  },
);
