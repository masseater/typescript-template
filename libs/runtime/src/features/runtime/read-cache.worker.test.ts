import { ConfigurationInvalid } from "@repo/config";
import { env } from "cloudflare:workers";
import { Effect, Layer, Ref } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { ReadCache } from "./read-cache.ts";

describe("ReadCache", () => {
  describe("a value loaded twice through KV", () => {
    const it = test.extend("cachedReads", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* cachedReadsProgram() {
          const cache = yield* ReadCache;
          const cacheKey = `cache/${crypto.randomUUID()}`;
          const cacheServices = yield* Effect.context();
          onCleanup(() => Effect.runPromiseWith(cacheServices)(cache.remove(cacheKey)));
          const loadCount = yield* Ref.make(0);
          const load = Ref.updateAndGet(loadCount, (loadsSoFar) => loadsSoFar + 1).pipe(
            Effect.map((loadNumber) => `value-${loadNumber}`),
          );
          const firstRead = yield* cache.getOrLoad(cacheKey, { load });
          const secondRead = yield* cache.getOrLoad(cacheKey, { load });
          return {
            firstRead,
            loads: yield* Ref.get(loadCount),
            secondRead,
            storedValue: yield* cache.get(cacheKey),
          };
        }).pipe(Effect.provide(ReadCache.fromEnvironment(env))),
      ));

    it("loads once and serves the next read from cache", ({ cachedReads }) => {
      expect(cachedReads).toStrictEqual({
        firstRead: "value-1",
        loads: 1,
        secondRead: "value-1",
        storedValue: "value-1",
      });
    });
  });

  describe("a cached value removed from KV", () => {
    const it = test.extend("removedValue", () =>
      Effect.runPromise(
        Effect.gen(function* removedValueProgram() {
          const cache = yield* ReadCache;
          const cacheKey = `cache/${crypto.randomUUID()}`;
          yield* cache.getOrLoad(cacheKey, { load: Effect.succeed("value-1") });
          yield* cache.remove(cacheKey);
          return yield* cache.get(cacheKey);
        }).pipe(Effect.provide(ReadCache.fromEnvironment(env))),
      ));

    it("is no longer found", ({ removedValue }) => {
      expect(removedValue).toBe(undefined);
    });
  });

  describe("an environment without the cache binding", () => {
    const it = test.extend("startupFailure", () =>
      Effect.runPromise(
        Layer.build(
          ReadCache.fromEnvironment(
            Object.fromEntries(
              Object.entries(env).filter(([bindingName]) => bindingName !== "CACHE"),
            ),
          ),
        ).pipe(Effect.scoped, Effect.flip),
      ));

    it("refuses to start", ({ startupFailure }) => {
      expect(startupFailure).toStrictEqual(
        ConfigurationInvalid.make({ reason: 'Missing key\n  at ["CACHE"]' }),
      );
    });
  });
});
