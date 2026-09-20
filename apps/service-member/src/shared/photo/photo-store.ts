import { photoContentTypes } from "@repo/config";
import { readStorage } from "@repo/config/storage";
import { withSpan } from "@repo/observability";
import { Context, Effect, Layer, Schema } from "effect";

import { PhotoStorageFailed } from "./photo-storage-failed.ts";

import type { R2Bucket } from "@cloudflare/workers-types";
import type { ConfigurationInvalid, PhotoContentType } from "@repo/config";

const isPhotoContentType = Schema.is(Schema.Literals(photoContentTypes));

interface StoredPhoto {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: PhotoContentType;
}

interface PhotoStoreShape {
  readonly get: (key: string) => Effect.Effect<StoredPhoto | undefined, PhotoStorageFailed>;
  readonly put: (key: string, photo: StoredPhoto) => Effect.Effect<void, PhotoStorageFailed>;
  readonly remove: (keys: readonly string[]) => Effect.Effect<void, PhotoStorageFailed>;
}

type Bucket = Pick<R2Bucket, "delete" | "get" | "put">;

const unavailable = Effect.fail(new PhotoStorageFailed({ reason: "unavailable" }));

function attempt<Value>(
  operation: string,
  run: () => Promise<Value>,
): Effect.Effect<Value, PhotoStorageFailed> {
  return Effect.tryPromise({
    catch: (cause) => new PhotoStorageFailed({ cause, reason: "operation_failed" }),
    try: run,
  }).pipe(withSpan(`photo.${operation}`));
}

function storeOf(bucket: Bucket): PhotoStoreShape {
  return {
    get: (key) =>
      attempt("get", async () => {
        const object = await bucket.get(key);
        if (object === null) {
          return undefined;
        }
        const contentType = object.httpMetadata?.contentType;
        if (!isPhotoContentType(contentType)) {
          throw new TypeError(`stored photo ${key} has content type ${String(contentType)}`);
        }
        return { bytes: new Uint8Array(await object.arrayBuffer()), contentType };
      }),
    put: (key, photo) =>
      attempt("put", async () => {
        await bucket.put(key, photo.bytes, { httpMetadata: { contentType: photo.contentType } });
      }),
    remove: (keys) =>
      keys.length === 0
        ? Effect.void
        : attempt("delete", async () => {
            await bucket.delete([...keys]);
          }),
  };
}

const unavailableStore: PhotoStoreShape = {
  get: () => unavailable,
  put: () => unavailable,
  remove: () => unavailable,
};

class PhotoStore extends Context.Service<PhotoStore, PhotoStoreShape>()(
  "#shared/photo/PhotoStore",
) {
  public static layer(bucket: Bucket | undefined): Layer.Layer<PhotoStore> {
    return Layer.succeed(
      PhotoStore,
      PhotoStore.of(bucket === undefined ? unavailableStore : storeOf(bucket)),
    );
  }

  public static fromEnvironment(env: unknown): Layer.Layer<PhotoStore, ConfigurationInvalid> {
    return Layer.unwrap(Effect.map(readStorage(env), (bucket) => PhotoStore.layer(bucket)));
  }
}

export { PhotoStore };
export type { StoredPhoto };
