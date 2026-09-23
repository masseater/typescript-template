import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { schemaDocument, schemaDocumentPath } from "./schema-document.ts";

describe("the schema page of the wiki", () => {
  const it = test.extend("committedPage", () =>
    Effect.runPromise(
      Effect.gen(function* readSchemaDocument() {
        const filesystem = yield* FileSystem.FileSystem;
        return yield* filesystem.readFileString(yield* schemaDocumentPath);
      }).pipe(Effect.orDie, Effect.provide(NodeServices.layer)),
    ));

  it("matches the ER diagram of the current schema; regenerate it with `vp run --filter @repo/db db:generate`", ({
    committedPage,
  }) => {
    expect(committedPage).toBe(schemaDocument());
  });
});
