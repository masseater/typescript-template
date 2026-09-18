import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  CONFLICTED_FILE,
  conflict,
  stage,
  withEmptyDirectory,
  withRepository,
} from "./staged-fixture.ts";
import { blobContents, stagedFiles } from "./staged.ts";

const GIT_USAGE_EXIT_CODE = 128;

function batch(blobs: readonly (readonly [string, string])[]): Buffer {
  return Buffer.concat(
    blobs.map(([object, content]: readonly [string, string]) =>
      Buffer.from(`${object} blob ${String(Buffer.byteLength(content))}\n${content}\n`),
    ),
  );
}

const blobs = [
  ["1111111111111111111111111111111111111111", "hello\n"],
  ["2222222222222222222222222222222222222222", "ユニコード\n"],
  ["3333333333333333333333333333333333333333", ""],
  ["4444444444444444444444444444444444444444", "null \0 byte\0"],
  ["5555555555555555555555555555555555555555", "tail without newline"],
] as const;

async function unreadable(
  framed: Readonly<Buffer>,
  objects: readonly string[],
): Promise<Readonly<Record<string, unknown>>> {
  const failure = await Effect.runPromise(Effect.flip(blobContents(framed, objects)));
  return failure.report;
}

async function report(root: string): Promise<Readonly<Record<string, unknown>>> {
  const failure = await Effect.runPromise(Effect.flip(stagedFiles(root)));
  return failure.report;
}

describe("git cat-file batch output", () => {
  it("frames every blob by its byte length", async () => {
    expect.assertions(1);
    const objects = blobs.map(([object]: readonly [string, string]) => object);
    const contents = await Effect.runPromise(blobContents(batch(blobs), objects));
    expect([...contents.values()]).toStrictEqual(
      blobs.map(([, content]: readonly [string, string]) => content),
    );
  });

  it("names the object git failed to answer with", async () => {
    expect.hasAssertions();
    const missing = "6666666666666666666666666666666666666666";
    await expect(unreadable(batch(blobs), [missing])).resolves.toStrictEqual({
      object: missing,
      reason: "blob-unreadable",
    });
    await expect(unreadable(Buffer.from("truncated"), [blobs[0][0]])).resolves.toStrictEqual({
      object: blobs[0][0],
      reason: "blob-unreadable",
    });
  });
});

describe("staged file reading", () => {
  it("reads what the index holds for every staged file", async () => {
    expect.assertions(1);
    await withRepository(async (root) => {
      await stage(root, "added.txt", "added\n");
      await expect(Effect.runPromise(stagedFiles(root))).resolves.toStrictEqual([
        { content: "added\n", filename: "added.txt" },
        { content: "base\n", filename: CONFLICTED_FILE },
      ]);
    });
  });

  it("refuses to scan an index left unmerged by a conflict, naming the files", async () => {
    expect.assertions(1);
    await withRepository(async (root) => {
      await conflict(root);
      await expect(report(root)).resolves.toStrictEqual({
        files: [CONFLICTED_FILE],
        reason: "unmerged-index",
      });
    });
  });

  it("reports the exit code when git cannot read the index at all", async () => {
    expect.assertions(1);
    await withEmptyDirectory(async (root) => {
      await expect(report(root)).resolves.toStrictEqual({
        command: "ls-files --cached --stage -z",
        exitCode: GIT_USAGE_EXIT_CODE,
        reason: "git-command-failed",
      });
    });
  });
});
