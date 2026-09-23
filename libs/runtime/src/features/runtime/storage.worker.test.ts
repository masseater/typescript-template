import { assert, describe, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { FileStore } from "./file-store.ts";
import { ReadCache } from "./read-cache.ts";
import { StorageFailed } from "./storage-failed.ts";

const storageLayer = Layer.mergeAll(FileStore.fromEnvironment(env), ReadCache.fromEnvironment(env));

describe("file storage and read cache", () => {
  it.effect("stores a file in R2 and reads the same bytes back", () =>
    Effect.gen(function* program() {
      const store = yield* FileStore;
      const key = `files/${crypto.randomUUID()}.bin`;
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      yield* store.put(key, { bytes, contentType: "application/octet-stream" });
      const stored = yield* store.get(key);
      assert.isDefined(stored);
      assert.strictEqual(stored.contentType, "application/octet-stream");
      assert.deepStrictEqual([...stored.bytes], [...bytes]);
      yield* store.remove([key]);
      assert.isUndefined(yield* store.get(key));
    }).pipe(Effect.provide(storageLayer)),
  );

  it.effect("caches a loaded value in KV and serves the next read from cache", () =>
    Effect.gen(function* program() {
      const cache = yield* ReadCache;
      const key = `cache/${crypto.randomUUID()}`;
      let loads = 0;
      const load = Effect.sync(() => {
        loads += 1;
        return `value-${loads}`;
      });
      const first = yield* cache.getOrLoad(key, load);
      const second = yield* cache.getOrLoad(key, load);
      assert.strictEqual(first, "value-1");
      assert.strictEqual(second, "value-1");
      assert.strictEqual(loads, 1);
      assert.strictEqual(yield* cache.get(key), "value-1");
      yield* cache.remove(key);
      assert.isUndefined(yield* cache.get(key));
    }).pipe(Effect.provide(storageLayer)),
  );

  it.effect("refuses to start when the file binding is missing from the environment", () =>
    Effect.gen(function* program() {
      const failure = yield* Layer.build(FileStore.fromEnvironment({})).pipe(
        Effect.scoped,
        Effect.flip,
      );
      assert.strictEqual(failure._tag, "ConfigurationInvalid");
    }),
  );

  it.effect("refuses to start when the cache binding is missing from the environment", () =>
    Effect.gen(function* program() {
      const failure = yield* Layer.build(ReadCache.fromEnvironment({})).pipe(
        Effect.scoped,
        Effect.flip,
      );
      assert.strictEqual(failure._tag, "ConfigurationInvalid");
    }),
  );

  it.effect("reports unavailable only when a store is intentionally omitted", () =>
    Effect.gen(function* program() {
      const store = yield* FileStore;
      const failure = yield* store.get("missing").pipe(Effect.flip);
      assert.instanceOf(failure, StorageFailed);
      assert.strictEqual(failure.reason, "unavailable");
    }).pipe(Effect.provide(FileStore.layer(undefined))),
  );
});
