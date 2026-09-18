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
}

interface Blob {
  readonly content: string;
  readonly end: number;
}

const MAX_OUTPUT_BYTES = 33_554_432;
const NEWLINE = 10;
const NOT_FOUND = -1;
const SIZE_FIELD = 2;
const ENTRY_PATTERN = /^\d+ (?<object>[0-9a-f]+) \d+\t(?<filename>[^]*)$/u;

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);

function indexEntries(listing: string): IndexEntry[] {
  return listing.split("\0").flatMap((entry) => {
    const groups = ENTRY_PATTERN.exec(entry)?.groups;
    const filename = groups?.["filename"];
    const object = groups?.["object"];
    return filename === undefined || object === undefined ? [] : [{ filename, object }];
  });
}

function blobAt(output: Readonly<Buffer>, offset: number, object: string): Blob {
  const headerEnd = output.indexOf(NEWLINE, offset);
  const header =
    headerEnd === NOT_FOUND ? [] : output.toString("utf-8", offset, headerEnd).split(" ");
  const size = Number(header[SIZE_FIELD]);
  if (header[0] !== object || !Number.isInteger(size)) {
    throw new Error(`git cat-file did not return the blob ${object}`);
  }
  const start = headerEnd + 1;
  return { content: output.toString("utf-8", start, start + size), end: start + size + 1 };
}

function blobContents(output: Readonly<Buffer>, objects: readonly string[]): Map<string, string> {
  const contents = new Map<string, string>();
  let offset = 0;
  for (const object of objects) {
    const blob = blobAt(output, offset, object);
    contents.set(object, blob.content);
    offset = blob.end;
  }
  return contents;
}

async function readBlobs(root: string, objects: readonly string[]): Promise<Map<string, string>> {
  const child = spawn("git", ["cat-file", "--batch"], { cwd: root });
  child.stdin.end(objects.map((object) => `${object}\n`).join(""));
  return blobContents(await buffer(child.stdout), objects);
}

class Unstaged extends Schema.TaggedError<Unstaged>()("Unstaged", {}) {}

function stagedFiles(root: string): Effect.Effect<StagedFile[], Unstaged> {
  return Effect.tryPromise({
    catch: () => new Unstaged(),
    try: async () => {
      const { stdout } = await run("git", ["ls-files", "--cached", "--stage", "-z"], {
        cwd: root,
        maxBuffer: MAX_OUTPUT_BYTES,
      });
      const entries = indexEntries(stdout);
      const contents = await readBlobs(root, [...new Set(entries.map(({ object }) => object))]);
      return entries.map(({ filename, object }) => ({
        content: contents.get(object) ?? "",
        filename,
      }));
    },
  });
}

export { blobContents, stagedFiles };
export type { StagedFile };
