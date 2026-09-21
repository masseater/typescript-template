import { readStorage } from "@repo/config/storage";
import { withSpan } from "@repo/observability";
import { Context, Effect, Layer } from "effect";

import { StorageFailed } from "./storage-failed.ts";

import type { KVNamespace } from "@cloudflare/workers-types";
import type { ConfigurationInvalid } from "@repo/config";

interface ReadCacheShape {
  readonly get: (key: string) => Effect.Effect<string | undefined, StorageFailed>;
  readonly put: (
    key: string,
    value: string,
    options?: { readonly expirationTtl?: number },
  ) => Effect.Effect<void, StorageFailed>;
  readonly remove: (key: string) => Effect.Effect<void, StorageFailed>;
  readonly getOrLoad: <Failure>(
    key: string,
    load: Effect.Effect<string, Failure>,
    options?: { readonly expirationTtl?: number },
  ) => Effect.Effect<string, Failure | StorageFailed>;
}

type Namespace = Pick<KVNamespace, "delete" | "get" | "put">;

const unavailable = Effect.fail(new StorageFailed({ reason: "unavailable" }));

function attempt<Value>(
  operation: string,
  run: () => Promise<Value>,
): Effect.Effect<Value, StorageFailed> {
  return Effect.tryPromise({
    catch: (cause) => new StorageFailed({ cause, reason: "operation_failed" }),
    try: run,
  }).pipe(withSpan(`storage.cache.${operation}`));
}

function cacheOf(namespace: Namespace): ReadCacheShape {
  const get = (key: string): Effect.Effect<string | undefined, StorageFailed> =>
    attempt("get", async () => {
      const value = await namespace.get(key);
      return value === null ? undefined : value;
    });
  const put = (
    key: string,
    value: string,
    options?: { readonly expirationTtl?: number },
  ): Effect.Effect<void, StorageFailed> =>
    attempt("put", async () => {
      await namespace.put(
        key,
        value,
        options?.expirationTtl === undefined ? undefined : { expirationTtl: options.expirationTtl },
      );
    });
  const remove = (key: string): Effect.Effect<void, StorageFailed> =>
    attempt("delete", async () => {
      await namespace.delete(key);
    });
  return {
    get,
    getOrLoad: (key, load, options) =>
      Effect.gen(function* cached() {
        const hit = yield* get(key);
        if (hit !== undefined) {
          return hit;
        }
        const value = yield* load;
        yield* put(key, value, options);
        return value;
      }),
    put,
    remove,
  };
}

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
