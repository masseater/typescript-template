import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { FileStore } from "./file-store.ts";
import { StorageFailed } from "./storage-failed.ts";

describe("FileStore", () => {
  describe("a file stored in R2", () => {
    const it = test.extend("storedFile", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* storedFileProgram() {
          const store = yield* FileStore;
          const fileName = `files/${crypto.randomUUID()}.bin`;
          yield* store.put(fileName, {
            bytes: new Uint8Array([1, 2, 3, 4, 5]),
            contentType: "application/octet-stream",
          });
          onCleanup(() => Effect.runPromise(store.remove([fileName])));
          return yield* store.get(fileName);
        }).pipe(Effect.provide(FileStore.fromEnvironment(env))),
      ));

    it("reads the same bytes back", ({ storedFile }) => {
      expect(storedFile).toStrictEqual({
        bytes: new Uint8Array([1, 2, 3, 4, 5]),
        contentType: "application/octet-stream",
      });
    });
  });

  describe("a file removed from R2", () => {
    const it = test.extend("removedFile", () =>
      Effect.runPromise(
        Effect.gen(function* removedFileProgram() {
          const store = yield* FileStore;
          const fileName = `files/${crypto.randomUUID()}.bin`;
          yield* store.put(fileName, {
            bytes: new Uint8Array([1, 2, 3, 4, 5]),
            contentType: "application/octet-stream",
          });
          yield* store.remove([fileName]);
          return yield* store.get(fileName);
        }).pipe(Effect.provide(FileStore.fromEnvironment(env))),
      ));

    it("is no longer found", ({ removedFile }) => {
      expect(removedFile).toBe(undefined);
    });
  });

  describe("a store without its binding", () => {
    const it = test.extend("storageFailure", () =>
      Effect.runPromise(
        Effect.gen(function* storageFailureProgram() {
          const store = yield* FileStore;
          return yield* Effect.flip(store.get("missing"));
        }).pipe(Effect.provide(FileStore.layer(undefined))),
      ));

    it("reports unavailable", ({ storageFailure }) => {
      expect(storageFailure).toStrictEqual(new StorageFailed({ reason: "unavailable" }));
    });
  });
});
