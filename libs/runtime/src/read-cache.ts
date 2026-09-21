import { readStorage } from "@repo/config/storage";
import { withSpan } from "@repo/observability";
import { Context, Effect, Layer } from "effect";

import { StorageFailed } from "./storage-failed.ts";

import type { KVNamespace } from "@cloudflare/workers-types";
import type { ConfigurationInvalid } from "@repo/config";
type ReadCacheShape = {
  readonly get: (fieldName: string) => Effect.Effect<string | undefined, StorageFailed>;
  readonly put: (
    fieldName: string,
    asked: {
      readonly decoded: string;
      readonly settings?: {
        readonly expirationTtl?: number;
      };
    },
  ) => Effect.Effect<void, StorageFailed>;
  readonly remove: (fieldName: string) => Effect.Effect<void, StorageFailed>;
  readonly getOrLoad: <Failure>(
    fieldName: string,
    asked: {
      readonly load: Effect.Effect<string, Failure>;
      readonly settings?: {
        readonly expirationTtl?: number;
      };
    },
  ) => Effect.Effect<string, Failure | StorageFailed>;
};
type Namespace = Pick<KVNamespace, "delete" | "get" | "put">;
const unavailable = Effect.fail(new StorageFailed({ reason: "unavailable" }));
const attempt = <Value>(
  operation: string,
  run: () => Promise<Value>,
): Effect.Effect<Value, StorageFailed> => {
  return Effect.tryPromise({
    catch: (cause) => new StorageFailed({ cause, reason: "operation_failed" }),
    try: run,
  }).pipe(withSpan(`storage.cache.${operation}`));
};
const cacheOf = (namespace: Namespace): ReadCacheShape => {
  const get = (fieldName: string): Effect.Effect<string | undefined, StorageFailed> =>
    attempt("get", async () => {
      const decoded = await namespace.get(fieldName);
      return decoded === null ? undefined : decoded;
    });
  const put = (
    fieldName: string,
    asked: {
      readonly decoded: string;
      readonly settings?: {
        readonly expirationTtl?: number;
      };
    },
  ): Effect.Effect<void, StorageFailed> =>
    attempt("put", async () => {
      await namespace.put(
        fieldName,
        asked.decoded,
        asked.settings?.expirationTtl === undefined
          ? undefined
          : { expirationTtl: asked.settings.expirationTtl },
      );
    });
  const remove = (fieldName: string): Effect.Effect<void, StorageFailed> =>
    attempt("delete", async () => {
      await namespace.delete(fieldName);
    });
  return {
    get,
    getOrLoad: (fieldName, asked) =>
      Effect.gen(function* cached() {
        const hit = yield* get(fieldName);
        if (hit !== undefined) {
          return hit;
        }
        const decoded = yield* asked.load;
        yield* put(fieldName, { decoded, settings: asked.settings });
        return decoded;
      }),
    put,
    remove,
  };
};
const unavailableCache: ReadCacheShape = {
  get: () => unavailable,
  getOrLoad: () => unavailable,
  put: () => unavailable,
  remove: () => unavailable,
};
class ReadCache extends Context.Service<ReadCache, ReadCacheShape>()("@repo/runtime/ReadCache") {
  public static layer(namespace: Namespace | undefined): Layer.Layer<ReadCache> {
    return Layer.succeed(
      ReadCache,
      ReadCache.of(namespace === undefined ? unavailableCache : cacheOf(namespace)),
    );
  }
  public static fromEnvironment(env: unknown): Layer.Layer<ReadCache, ConfigurationInvalid> {
    return Layer.unwrap(Effect.map(readStorage(env), (storage) => ReadCache.layer(storage.cache)));
  }
}
export { ReadCache };
