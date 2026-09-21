import { isPhotoContentType } from "@repo/config";
import { FileStore, StorageFailed } from "@repo/runtime";
import { Context, Effect, Layer } from "effect";

import { PhotoStorageFailed } from "./photo-storage-failed.ts";

import type { SanitizedImage } from "./image.ts";

interface PhotoStoreShape {
  readonly get: (key: string) => Effect.Effect<SanitizedImage | undefined, PhotoStorageFailed>;
  readonly put: (key: string, photo: SanitizedImage) => Effect.Effect<void, PhotoStorageFailed>;
  readonly remove: (keys: readonly string[]) => Effect.Effect<void, PhotoStorageFailed>;
}

const mapFailure = (cause: StorageFailed): PhotoStorageFailed =>
  new PhotoStorageFailed({ cause, reason: cause.reason });

class PhotoStore extends Context.Service<PhotoStore, PhotoStoreShape>()(
  "#shared/photo/PhotoStore",
) {
  public static fromFileStore(): Layer.Layer<PhotoStore, never, FileStore> {
    return Layer.effect(
      PhotoStore,
      Effect.gen(function* photoStoreFromFiles() {
        const files = yield* FileStore;
        return PhotoStore.of({
          get: (key) =>
            files.get(key).pipe(
              Effect.mapError(mapFailure),
              Effect.flatMap((stored) => {
                if (stored === undefined) {
                  return Effect.succeed(undefined);
                }
                if (!isPhotoContentType(stored.contentType)) {
                  return Effect.fail(
                    new PhotoStorageFailed({
                      cause: new TypeError(
                        `stored photo ${key} has content type ${String(stored.contentType)}`,
                      ),
                      reason: "operation_failed",
                    }),
                  );
                }
                return Effect.succeed({
                  bytes: new Uint8Array(stored.bytes),
                  contentType: stored.contentType,
                } satisfies SanitizedImage);
              }),
            ),
          put: (key, photo) =>
            files
              .put(key, { bytes: photo.bytes, contentType: photo.contentType })
              .pipe(Effect.mapError(mapFailure)),
          remove: (keys) => files.remove(keys).pipe(Effect.mapError(mapFailure)),
        });
      }),
    );
  }
}

export { PhotoStore };
