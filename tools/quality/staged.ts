// oxlint-disable-next-line import/no-nodejs-modules
import { execFile, spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { buffer } from "node:stream/consumers";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

import { Effect, Schema } from "effect";

interface StagedFile {
  readonly content: string;
  readonly filename: string;
}

interface IndexEntry {
  readonly filename: string;
  readonly object: string;
  readonly stage: string;
}

interface FramedBlob {
  readonly content: string;
  readonly end: number;
}

const MAX_OUTPUT_BYTES = 33_554_432;
const NEWLINE = 10;
const NOT_FOUND = -1;
const SIZE_FIELD = 2;
const MERGED_STAGE = "0";
const ENTRY_PATTERN = /^\d+ (?<object>[0-9a-f]+) (?<stage>\d+)\t(?<filename>[^]*)$/u;
const LIST_INDEX = ["ls-files", "--cached", "--stage", "-z"] as const;
const READ_BLOBS = ["cat-file", "--batch"] as const;

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);

class StagedUnreadable extends Schema.TaggedError<StagedUnreadable>()("StagedUnreadable", {
  command: Schema.optional(Schema.String),
  entry: Schema.optional(Schema.String),
  exitCode: Schema.optional(Schema.Number),
  files: Schema.optional(Schema.Array(Schema.String)),
  object: Schema.optional(Schema.String),
  reason: Schema.Literals([
    "blob-unreadable",
    "git-command-failed",
    "index-entry-unreadable",
    "unmerged-index",
  ]),
}) {
  public get report(): Readonly<Record<string, unknown>> {
    const fields: Readonly<Record<string, unknown>> = {
      command: this.command,
      entry: this.entry,
      exitCode: this.exitCode,
      files: this.files,
      object: this.object,
      reason: this.reason,
    };
    const present = Object.entries(fields).filter(([, value]) => value !== undefined);
    return Object.fromEntries(present);
  }
}

function exitCode(error: unknown): number | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
    ? error.code
    : undefined;
}

function commandFailed(args: readonly string[]): (error: unknown) => StagedUnreadable {
  return (error) =>
    new StagedUnreadable({
      command: args.join(" "),
      exitCode: exitCode(error),
      reason: "git-command-failed",
    });
}

function listIndex(root: string): Effect.Effect<string, StagedUnreadable> {
  return Effect.tryPromise({
    catch: commandFailed(LIST_INDEX),
    try: async () => {
      const listing = await run("git", [...LIST_INDEX], {
        cwd: root,
        maxBuffer: MAX_OUTPUT_BYTES,
      });
      return listing.stdout;
    },
  });
}

function merged(
  entries: readonly IndexEntry[],
): Effect.Effect<readonly IndexEntry[], StagedUnreadable> {
  const unmerged = entries.filter(({ stage }) => stage !== MERGED_STAGE);
  const files = [...new Set(unmerged.map(({ filename }) => filename))];
  return files.length > 0
    ? Effect.fail(new StagedUnreadable({ files, reason: "unmerged-index" }))
    : Effect.succeed(entries);
}

function parseEntry(entry: string): Effect.Effect<IndexEntry, StagedUnreadable> {
  const groups = ENTRY_PATTERN.exec(entry)?.groups;
  const filename = groups?.["filename"];
  const object = groups?.["object"];
  const stage = groups?.["stage"];
  return filename === undefined || object === undefined || stage === undefined
    ? Effect.fail(new StagedUnreadable({ entry, reason: "index-entry-unreadable" }))
    : Effect.succeed({ filename, object, stage });
}

function indexEntries(listing: string): Effect.Effect<readonly IndexEntry[], StagedUnreadable> {
  const listed = listing.split("\0").filter((entry) => entry !== "");
  return Effect.forEach(listed, parseEntry).pipe(Effect.flatMap(merged));
}

function blobAt(output: Readonly<Buffer>, offset: number, object: string): FramedBlob | undefined {
  const headerEnd = output.indexOf(NEWLINE, offset);
  const header =
    headerEnd === NOT_FOUND ? [] : output.toString("utf-8", offset, headerEnd).split(" ");
  const size = Number(header[SIZE_FIELD]);
  if (header[0] !== object || !Number.isInteger(size)) {
    return undefined;
  }
  const start = headerEnd + 1;
  return { content: output.toString("utf-8", start, start + size), end: start + size + 1 };
}

function blobContents(
  output: Readonly<Buffer>,
  objects: readonly string[],
): Effect.Effect<ReadonlyMap<string, string>, StagedUnreadable> {
  const framed = Effect.reduce(
    objects,
    () => ({ contents: new Map<string, string>(), offset: 0 }),
    (state, object) => {
      const blob = blobAt(output, state.offset, object);
      return blob === undefined
        ? Effect.fail(new StagedUnreadable({ object, reason: "blob-unreadable" }))
        : Effect.succeed({ contents: state.contents.set(object, blob.content), offset: blob.end });
    },
  );
  return Effect.map(framed, ({ contents }) => contents);
}

function readBlobs(
  root: string,
  objects: readonly string[],
): Effect.Effect<ReadonlyMap<string, string>, StagedUnreadable> {
  const output = Effect.tryPromise({
    catch: commandFailed(READ_BLOBS),
    try: async () => {
      const child = spawn("git", [...READ_BLOBS], { cwd: root });
      child.stdin.end(objects.map((object) => `${object}\n`).join(""));
      return buffer(child.stdout);
    },
  });
  return Effect.flatMap(output, (framed) => blobContents(framed, objects));
}

const stagedFiles = Effect.fn("stagedFiles")(function* stagedFiles(root: string) {
  const entries = yield* Effect.flatMap(listIndex(root), indexEntries);
  const contents = yield* readBlobs(root, [...new Set(entries.map(({ object }) => object))]);
  return yield* Effect.forEach(entries, ({ filename, object }) => {
    const content = contents.get(object);
    return content === undefined
      ? Effect.fail(new StagedUnreadable({ object, reason: "blob-unreadable" }))
      : Effect.succeed({ content, filename });
  });
});

export { blobContents, stagedFiles };
export type { StagedFile };
