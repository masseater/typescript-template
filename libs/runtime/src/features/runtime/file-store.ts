import { Context, Effect, Layer } from "effect";

import { storageAttempt, unavailable, type StorageFailed } from "./storage-failed.ts";

import type { R2Bucket } from "@cloudflare/workers-types";

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

const attempt = storageAttempt("files");

function storeOf(bucket: Bucket): FileStoreShape {
  return {
    get: (key) =>
      attempt("get", () =>
        bucket.get(key).then((object) =>
          object === null
            ? undefined
            : object.arrayBuffer().then((buffer) => ({
                bytes: new Uint8Array(buffer),
                contentType: object.httpMetadata?.contentType,
              })),
        ),
      ),
    put: (key, file) =>
      attempt("put", () =>
        bucket.put(
          key,
          file.bytes,
          file.contentType === undefined
            ? undefined
            : { httpMetadata: { contentType: file.contentType } },
        ),
      ),
    remove: (keys) =>
      keys.length === 0 ? Effect.void : attempt("delete", () => bucket.delete([...keys])),
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
}

export { FileStore };
export type { Bucket, StoredFile };
