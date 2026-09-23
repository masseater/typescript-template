import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  CONFLICTED_FILE,
  conflict,
  emptyDirectory,
  repository,
  save,
  stage,
} from "./staged-fixture.ts";
import { indexSecretHits } from "./staged.ts";

const GIT_USAGE_EXIT_CODE = 128;

const report = (root: string) =>
  Effect.map(Effect.flip(indexSecretHits(root, [])), (failure) => failure.report);

layer(NodeServices.layer)("index secret scanning", (it) => {
  describe("a clean index", () => {
    it.effect("reports no hits", () =>
      Effect.gen(function* program() {
        const root = yield* repository;
        yield* stage(root, "added.txt", "added\n");
        expect(yield* indexSecretHits(root, [])).toStrictEqual({ hits: [], scan: "word" });
      }),
    );
  });

  describe("an index file that matches a content rule", () => {
    it.effect("is named", () =>
      Effect.gen(function* program() {
        const root = yield* repository;
        const awsAccessKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
        yield* stage(root, "key.txt", `${awsAccessKey}\n`);
        expect(yield* indexSecretHits(root, [])).toStrictEqual({
          hits: [{ filename: "key.txt", rules: ["aws-access-key"] }],
          scan: "word",
        });
      }),
    );
  });

  describe("a private path tracked in the index", () => {
    it.effect("is flagged", () =>
      Effect.gen(function* program() {
        const root = yield* repository;
        yield* stage(root, ".env", "VISIBLE=1\n");
        expect(yield* indexSecretHits(root, [])).toStrictEqual({
          hits: [{ filename: ".env", rules: ["private-file"] }],
          scan: "word",
        });
      }),
    );
  });

  describe("a deployment value introduced by the staged patch", () => {
    it.effect("is flagged", () =>
      Effect.gen(function* program() {
        const root = yield* repository;
        yield* stage(root, "new.txt", "zzprefix-user\n");
        expect(
          yield* indexSecretHits(root, [{ key: "TEMPLATE_PREFIX", value: "zzprefix" }]),
        ).toStrictEqual({
          hits: [{ filename: "new.txt", rules: ["deployment-value:TEMPLATE_PREFIX"] }],
          scan: "separated",
        });
      }),
    );
  });

  describe("a deployment value that is already on main", () => {
    it.effect("is left out of a later patch", () =>
      Effect.gen(function* program() {
        const root = yield* repository;
        yield* save(root, "existing.txt", "zzprefix-user\n");
        yield* stage(root, "note.txt", "unrelated\n");
        expect(
          yield* indexSecretHits(root, [
            { key: "TEMPLATE_APP_DOMAIN", value: "zzprefix-user" },
            { key: "TEMPLATE_PREFIX", value: "zzprefix" },
          ]),
        ).toStrictEqual({ hits: [], scan: "separated" });
      }),
    );
  });

  describe("an index left unmerged by a conflict", () => {
    it.effect("is refused, naming the files", () =>
      Effect.gen(function* program() {
        const root = yield* repository;
        yield* conflict(root);
        expect(yield* report(root)).toStrictEqual({
          files: [CONFLICTED_FILE],
          reason: "unmerged-index",
        });
      }),
    );
  });

  describe("a directory git cannot read an index from at all", () => {
    it.effect("reports the exit code", () =>
      Effect.gen(function* program() {
        const root = yield* emptyDirectory;
        expect(yield* report(root)).toStrictEqual({
          command: "ls-files --unmerged -z",
          exitCode: GIT_USAGE_EXIT_CODE,
          reason: "git-command-failed",
        });
      }),
    );
  });
});
