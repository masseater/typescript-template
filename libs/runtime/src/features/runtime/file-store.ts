import { readStorage } from "@repo/config/storage";
import { Context, Effect, Layer } from "effect";

import { StorageFailed, storageAttempt, storageUnavailable } from "./storage-failed.ts";

import type { R2Bucket, ReadableStream as BucketStream } from "@cloudflare/workers-types";
import type { ConfigurationInvalid } from "@repo/config";
type StoredFile = {
  readonly bytes: Uint8Array;
  readonly contentType: string | undefined;
};
type StreamedFile = {
  readonly body: BucketStream;
  readonly contentType: string | undefined;
  readonly size: number;
};
type FileStoreShape = {
  readonly get: (fieldName: string) => Effect.Effect<StoredFile | undefined, StorageFailed>;
  readonly open: (fieldName: string) => Effect.Effect<StreamedFile | undefined, StorageFailed>;
  readonly put: (fieldName: string, file: StoredFile) => Effect.Effect<void, StorageFailed>;
  readonly putStream: (
    fieldName: string,
    file: Readonly<{ body: ReadableStream; contentType: string | undefined }>,
  ) => Effect.Effect<void, StorageFailed>;
  readonly remove: (fieldNames: readonly string[]) => Effect.Effect<void, StorageFailed>;
  readonly removePrefix: (prefix: string) => Effect.Effect<void, StorageFailed>;
};
type Bucket = Pick<R2Bucket, "delete" | "get" | "list" | "put">;
const isBucketStream = (candidate: unknown): candidate is BucketStream =>
  candidate instanceof ReadableStream;
const attempt = storageAttempt("files");
const uploadOptions = (
  contentType: string | undefined,
): { readonly httpMetadata: { readonly contentType: string } } | undefined =>
  contentType === undefined ? undefined : { httpMetadata: { contentType } };
const removeListed = (
  bucket: Bucket,
  listing: Readonly<{ prefix: string; cursor?: string }>,
): Effect.Effect<void, StorageFailed> =>
  Effect.gen(function* removeListedPage() {
    const listed = yield* attempt("list", () => bucket.list(listing));
    const fieldNames = listed.objects.map((stored) => stored.key);
    if (fieldNames.length > 0) {
      yield* attempt("delete", () => bucket.delete(fieldNames));
    }
    if (listed.truncated) {
      yield* removeListed(bucket, { cursor: listed.cursor, prefix: listing.prefix });
    }
  });
const storeOf = (bucket: Bucket): FileStoreShape => ({
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
  open: (fieldName) =>
    attempt("open", () => bucket.get(fieldName)).pipe(
      Effect.map((shape) =>
        shape === null
          ? undefined
          : {
              body: shape.body,
              contentType: shape.httpMetadata?.contentType,
              size: shape.size,
            },
      ),
    ),
  put: (fieldName, file) =>
    attempt("put", () => bucket.put(fieldName, file.bytes, uploadOptions(file.contentType))),
  putStream: (fieldName, file) => {
    const { body } = file;
    return isBucketStream(body)
      ? attempt("put", () => bucket.put(fieldName, body, uploadOptions(file.contentType)))
      : Effect.fail(new StorageFailed({ reason: "operation_failed" }));
  },
  remove: (fieldNames) =>
    fieldNames.length === 0 ? Effect.void : attempt("delete", () => bucket.delete([...fieldNames])),
  removePrefix: (prefix) =>
    prefix.length === 0
      ? Effect.fail(new StorageFailed({ reason: "operation_failed" }))
      : removeListed(bucket, { prefix }),
});
const unavailableStore: FileStoreShape = {
  get: () => storageUnavailable,
  open: () => storageUnavailable,
  put: () => storageUnavailable,
  putStream: () => storageUnavailable,
  remove: () => storageUnavailable,
  removePrefix: () => storageUnavailable,
};
class FileStore extends Context.Service<FileStore, FileStoreShape>()(
  "@repo/runtime/features/runtime/file-store/FileStore",
) {
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
export type { Bucket, StoredFile, StreamedFile };
