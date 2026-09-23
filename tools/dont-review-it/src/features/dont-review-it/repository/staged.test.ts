import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  CONFLICTED_FILE,
  conflict,
  save,
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

  it("flags a deployment value introduced by the staged patch", async () => {
    expect.assertions(1);
    await withRepository(async (root) => {
      await stage(root, "new.txt", "zzprefix-user\n");
      await expect(
        Effect.runPromise(indexSecretHits(root, [{ key: "TEMPLATE_PREFIX", value: "zzprefix" }])),
      ).resolves.toStrictEqual({
        hits: [{ filename: "new.txt", rules: ["deployment-value:TEMPLATE_PREFIX"] }],
        scan: "separated",
      });
    });
  });

  it("leaves a deployment value that is already on main out of a later patch", async () => {
    expect.assertions(1);
    await withRepository(async (root) => {
      await save(root, "existing.txt", "zzprefix-user\n");
      await stage(root, "note.txt", "unrelated\n");
      await expect(
        Effect.runPromise(
          indexSecretHits(root, [
            { key: "TEMPLATE_APP_DOMAIN", value: "zzprefix-user" },
            { key: "TEMPLATE_PREFIX", value: "zzprefix" },
          ]),
        ),
      ).resolves.toStrictEqual({
        hits: [],
        scan: "separated",
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
