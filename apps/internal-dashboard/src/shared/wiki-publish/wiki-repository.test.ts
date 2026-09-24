import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { mergeQueueLabel, wikiDocsDirectory } from "./wiki-repository.ts";

const repositoryFile = (relative: string) =>
  Effect.gen(function* repositoryPath() {
    const path = yield* Path.Path;
    return path.join(repositoryRoot, relative);
  });

describe("a published wiki pull request", () => {
  it("carries the label the merge queue picks up", () =>
    Effect.runPromise(
      Effect.gen(function* mergifyLabel() {
        expect.hasAssertions();
        const fileSystem = yield* FileSystem.FileSystem;
        const mergify = yield* fileSystem.readFileString(yield* repositoryFile(".mergify.yml"));
        expect(mergify).toContain(`label = ${mergeQueueLabel}`);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("writes into the directory the wiki is built from", () =>
    Effect.runPromise(
      Effect.gen(function* docsDirectory() {
        expect.hasAssertions();
        const fileSystem = yield* FileSystem.FileSystem;
        expect(
          yield* fileSystem.exists(yield* repositoryFile(`${wikiDocsDirectory}/index.md`)),
        ).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});
