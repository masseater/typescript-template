import { ConfigurationInvalid } from "@repo/config";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
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
          const storeServices = yield* Effect.context();
          onCleanup(() => Effect.runPromiseWith(storeServices)(store.remove([fileName])));
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

  describe("a file streamed into R2", () => {
    const it = test.extend("streamedFile", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* streamedFileProgram() {
          const store = yield* FileStore;
          const fileName = `files/${crypto.randomUUID()}.bin`;
          const { body } = new Response(new Uint8Array([6, 7, 8]));
          if (body === null) {
            return yield* Effect.die(new Error("response body is missing"));
          }
          yield* store.putStream(fileName, { body, contentType: "audio/mp4" });
          const storeServices = yield* Effect.context();
          onCleanup(() => Effect.runPromiseWith(storeServices)(store.remove([fileName])));
          const opened = yield* store.open(fileName);
          const stored = yield* store.get(fileName);
          return { bytes: stored?.bytes, contentType: opened?.contentType, size: opened?.size };
        }).pipe(Effect.provide(FileStore.fromEnvironment(env))),
      ));

    it("keeps the streamed bytes and reports their size", ({ streamedFile }) => {
      expect(streamedFile).toStrictEqual({
        bytes: new Uint8Array([6, 7, 8]),
        contentType: "audio/mp4",
        size: 3,
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

  describe("files removed by prefix", () => {
    const it = test.extend("prefixRemoval", () =>
      Effect.runPromise(
        Effect.gen(function* prefixRemovalProgram() {
          const store = yield* FileStore;
          const folder = `files/${crypto.randomUUID()}`;
          const fieldNames = [`${folder}/a.bin`, `${folder}/nested/b.bin`, `${folder}-other/c.bin`];
          yield* Effect.forEach(fieldNames, (fieldName) =>
            store.put(fieldName, { bytes: new Uint8Array([1]), contentType: undefined }),
          );
          yield* store.removePrefix(`${folder}/`);
          const remaining = yield* Effect.forEach(fieldNames, (fieldName) =>
            store.get(fieldName).pipe(Effect.map((stored) => stored !== undefined)),
          );
          yield* store.remove(fieldNames);
          return remaining;
        }).pipe(Effect.provide(FileStore.fromEnvironment(env))),
      ));

    it("removes only the files under that prefix", ({ prefixRemoval }) => {
      expect(prefixRemoval).toStrictEqual([false, false, true]);
    });
  });

  describe("an environment without the file binding", () => {
    const it = test.extend("startupFailure", () =>
      Effect.runPromise(
        Layer.build(
          FileStore.fromEnvironment(
            Object.fromEntries(
              Object.entries(env).filter(([bindingName]) => bindingName !== "FILES"),
            ),
          ),
        ).pipe(Effect.scoped, Effect.flip),
      ));

    it("refuses to start", ({ startupFailure }) => {
      expect(startupFailure).toStrictEqual(
        ConfigurationInvalid.make({ reason: 'Missing key\n  at ["FILES"]' }),
      );
    });
  });

  describe("a store intentionally omitted", () => {
    const it = test.extend("storageFailure", () =>
      Effect.runPromise(
        Effect.gen(function* storageFailureProgram() {
          const store = yield* FileStore;
          return yield* Effect.flip(store.get("missing"));
        }).pipe(Effect.provide(FileStore.layer(undefined))),
      ));

    it("reports unavailable only then", ({ storageFailure }) => {
      expect(storageFailure).toStrictEqual(StorageFailed.make({ reason: "unavailable" }));
    });
  });
});
