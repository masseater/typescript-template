import { readStorage } from "@repo/config/storage";
import { Context, Effect, Layer } from "effect";

import { storageAttempt, unavailable, type StorageFailed } from "./storage-failed.ts";

import type { R2Bucket } from "@cloudflare/workers-types";
import type { ConfigurationInvalid } from "@repo/config";
type StoredFile = {
  readonly bytes: Uint8Array;
  readonly contentType: string | undefined;
};
type FileStoreShape = {
  readonly get: (fieldName: string) => Effect.Effect<StoredFile | undefined, StorageFailed>;
  readonly put: (fieldName: string, file: StoredFile) => Effect.Effect<void, StorageFailed>;
  readonly remove: (fieldNames: readonly string[]) => Effect.Effect<void, StorageFailed>;
};
type Bucket = Pick<R2Bucket, "delete" | "get" | "put">;
const attempt = storageAttempt("files");
const storeOf = (bucket: Bucket): FileStoreShape => {
  return {
    get: (fieldName) =>
      Effect.gen(function* getFile() {
        const shape = yield* attempt("get", () => bucket.get(fieldName));
        if (shape === null) {
          return undefined;
        }
        const fileBytes = yield* attempt("get", () => shape.arrayBuffer());
        return {
          bytes: new Uint8Array(fileBytes),
          contentType: shape.httpMetadata?.contentType,
        };
      }),
    put: (fieldName, file) =>
      attempt("put", () =>
        bucket.put(
          fieldName,
          file.bytes,
          file.contentType === undefined
            ? undefined
            : { httpMetadata: { contentType: file.contentType } },
        ),
      ),
    remove: (fieldNames) =>
      fieldNames.length === 0
        ? Effect.void
        : attempt("delete", () => bucket.delete([...fieldNames])),
  };
};
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
export type { Bucket, StoredFile };
