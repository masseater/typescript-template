import { readStorage } from "@repo/config/storage";
import { withSpan } from "@repo/observability";
import { Context, Effect, Layer } from "effect";

import { StorageFailed } from "./storage-failed.ts";

import type { R2Bucket } from "@cloudflare/workers-types";
import type { ConfigurationInvalid } from "@repo/config";

interface StoredFile {
  readonly bytes: Uint8Array;
  readonly contentType: string | undefined;
}

interface FileStoreShape {
  readonly get: (key: string) => Effect.Effect<StoredFile | undefined, StorageFailed>;
  readonly put: (key: string, file: StoredFile) => Effect.Effect<void, StorageFailed>;
  readonly remove: (keys: readonly string[]) => Effect.Effect<void, StorageFailed>;
}

type Bucket = Pick<R2Bucket, "delete" | "get" | "put">;

const unavailable = Effect.fail(new StorageFailed({ reason: "unavailable" }));

function attempt<Value>(
  operation: string,
  run: () => Promise<Value>,
): Effect.Effect<Value, StorageFailed> {
  return Effect.tryPromise({
    catch: (cause) => new StorageFailed({ cause, reason: "operation_failed" }),
    try: run,
  }).pipe(withSpan(`storage.files.${operation}`));
}

function storeOf(bucket: Bucket): FileStoreShape {
  return {
    get: (key) =>
      attempt("get", async () => {
        const object = await bucket.get(key);
        if (object === null) {
          return undefined;
        }
        return {
          bytes: new Uint8Array(await object.arrayBuffer()),
          contentType: object.httpMetadata?.contentType,
        };
      }),
    put: (key, file) =>
      attempt("put", async () => {
        await bucket.put(
          key,
          file.bytes,
          file.contentType === undefined
            ? undefined
            : { httpMetadata: { contentType: file.contentType } },
        );
      }),
    remove: (keys) =>
      keys.length === 0
        ? Effect.void
        : attempt("delete", async () => {
            await bucket.delete([...keys]);
          }),
  };
}

const unavailableStore: FileStoreShape = {
  get: () => unavailable,
  put: () => unavailable,
  remove: () => unavailable,
};

class FileStore extends Context.Service<FileStore, FileStoreShape>()("@repo/runtime/FileStore") {
  public static layer(bucket: Bucket | undefined): Layer.Layer<FileStore> {
    return Layer.succeed(
      FileStore,
      FileStore.of(bucket === undefined ? unavailableStore : storeOf(bucket)),
    );
  }

  public static fromEnvironment(env: unknown): Layer.Layer<FileStore, ConfigurationInvalid> {
    return Layer.unwrap(Effect.map(readStorage(env), (storage) => FileStore.layer(storage.files)));
  }
}

export { FileStore };
export type { StoredFile };
