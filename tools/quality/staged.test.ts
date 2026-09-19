import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  CONFLICTED_FILE,
  conflict,
  stage,
  withEmptyDirectory,
  withRepository,
} from "./staged-fixture.ts";
import { indexSecretHits } from "./staged.ts";

const GIT_USAGE_EXIT_CODE = 128;

const report = async (root: string): Promise<Readonly<Record<string, unknown>>> => {
  const failure = await Effect.runPromise(Effect.flip(indexSecretHits(root, [])));
  return failure.report;
};

describe("index secret scanning", () => {
  it("reports no hits for a clean index", async () => {
    expect.assertions(1);
    await withRepository(async (root) => {
      await stage(root, "added.txt", "added\n");
      await expect(Effect.runPromise(indexSecretHits(root, []))).resolves.toStrictEqual({
        hits: [],
        scan: "word",
      });
    });
  });

  it("names index files that match a content rule", async () => {
    expect.assertions(1);
    await withRepository(async (root) => {
      const awsAccessKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
      await stage(root, "key.txt", `${awsAccessKey}\n`);
      await expect(Effect.runPromise(indexSecretHits(root, []))).resolves.toStrictEqual({
        hits: [{ filename: "key.txt", rules: ["aws-access-key"] }],
        scan: "word",
      });
    });
  });

  it("flags private paths that are tracked in the index", async () => {
    expect.assertions(1);
    await withRepository(async (root) => {
      await stage(root, ".env", "VISIBLE=1\n");
      await expect(Effect.runPromise(indexSecretHits(root, []))).resolves.toStrictEqual({
        hits: [{ filename: ".env", rules: ["private-file"] }],
        scan: "word",
      });
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
        command: "ls-files --unmerged -z",
        exitCode: GIT_USAGE_EXIT_CODE,
        reason: "git-command-failed",
      });
    });
  });
});
