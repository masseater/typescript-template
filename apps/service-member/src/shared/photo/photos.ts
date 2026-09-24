import {
  photoKeysOf,
  purgeExpiredWithdrawnMembers,
  setPhotoKey,
  visiblePhotoKey,
  withdrawMember,
} from "@repo/db";
import { Effect } from "effect";

import { sanitizeImage } from "./image.ts";
import { photoKey, photoVersion } from "./photo-key.ts";
import { PhotoNotFound } from "./photo-not-found.ts";
import { PhotoStore } from "./photo-store.ts";
import { PhotoUnsupported } from "./photo-unsupported.ts";

import type { PhotoSlot } from "@repo/config";

interface PhotoState {
  readonly slot: PhotoSlot;
  readonly version: string | null;
}

const uploadPhoto = Effect.fn("uploadPhoto")(function* uploadPhoto(
  memberId: string,
  slot: PhotoSlot,
  bytes: Uint8Array,
) {
  const sanitized = sanitizeImage(bytes);
  if (sanitized === undefined) {
    return yield* new PhotoUnsupported();
  }
  const store = yield* PhotoStore;
  const key = photoKey(memberId, slot, crypto.randomUUID());
  yield* store.put(key, sanitized);
  const previous = yield* setPhotoKey({ memberId, photoKey: key, slot }).pipe(
    Effect.tapError(() => store.remove([key]).pipe(Effect.ignore({ log: true }))),
  );
  if (previous !== null) {
    yield* store.remove([previous]);
  }
  return { slot, version: photoVersion(key) } satisfies PhotoState;
});

const readPhoto = Effect.fn("readPhoto")(function* readPhoto(
  viewerId: string,
  memberId: string,
  slot: PhotoSlot,
) {
  const key = yield* visiblePhotoKey({ memberId, slot, viewerId });
  if (key === undefined) {
    return yield* new PhotoNotFound();
  }
  const photo = yield* (yield* PhotoStore).get(key);
  if (photo === undefined) {
    return yield* new PhotoNotFound();
  }
  return photo;
});

const removePhoto = Effect.fn("removePhoto")(function* removePhoto(
  memberId: string,
  slot: PhotoSlot,
) {
  const previous = yield* setPhotoKey({ memberId, photoKey: null, slot });
  if (previous !== null) {
    yield* (yield* PhotoStore).remove([previous]);
  }
  return { slot, version: null } satisfies PhotoState;
});

const withdrawWithPhotos = Effect.fn("withdrawWithPhotos")(function* withdrawWithPhotos(
  memberId: string,
  options: Readonly<{ immediate: boolean }>,
) {
  const keys = yield* photoKeysOf(memberId);
  const withdrawn = yield* withdrawMember(memberId, options);
  const stored = Object.values(keys).filter((key): key is string => key !== null);
  yield* (yield* PhotoStore).remove(stored).pipe(Effect.ignore({ log: true }));
  return { ...withdrawn, removedPhotos: stored.length };
});

const purgeWithdrawnWithPhotos = Effect.fn("purgeWithdrawnWithPhotos")(
  function* purgeWithdrawnWithPhotos(checkedAt: Date) {
    const store = yield* PhotoStore;
    return yield* purgeExpiredWithdrawnMembers(checkedAt, store.remove);
  },
);

export { purgeWithdrawnWithPhotos, readPhoto, removePhoto, uploadPhoto, withdrawWithPhotos };
