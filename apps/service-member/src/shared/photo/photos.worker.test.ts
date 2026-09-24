import { assert, it } from "@effect/vitest";
import {
  PHOTO_CONTENT_TYPE,
  PHOTO_SLOT,
  PROFILE_VISIBILITY,
  ROLE,
  maximumPhotoBytes,
} from "@repo/config";
import { photoKeysOf, query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { FileStore } from "@repo/runtime";
import { AppOrigin } from "@repo/runtime/http";
import { testFileStore } from "@repo/runtime/testing";
import { Effect, Layer, DateTime } from "effect";

import { containsExifMarker, jpegWithExif, pngWithText } from "./image-test-fixture.ts";
import { PhotoStore } from "./photo-store.ts";
import {
  purgeWithdrawnWithPhotos,
  readPhoto,
  removePhoto,
  uploadPhoto,
  withdrawWithPhotos,
} from "./photos.ts";
import { readPhotoUpload } from "./upload.ts";

import type { ProfileVisibility, Role } from "@repo/config";
import type { Database, DatabaseFailure } from "@repo/db";
import type { PhotoStorageFailed } from "./photo-storage-failed.ts";

const { user, withdrawnMember } = schema;
const origin = "http://localhost:3001";

const services = Layer.mergeAll(
  TestDatabase,
  PhotoStore.fromFileStore().pipe(Layer.provide(testFileStore)),
  Layer.succeed(AppOrigin, origin),
);

function failureTag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

function addUser(
  id: string,
  visibility: ProfileVisibility = PROFILE_VISIBILITY.allMembers,
  role: Role = ROLE.member,
): Effect.Effect<void, DatabaseFailure, Database> {
  return query((database) =>
    database
      .insert(user)
      .values({
        createdAt: DateTime.toDate(DateTime.nowUnsafe()),
        email: `${id}@example.com`,
        emailVerified: true,
        id,
        name: id,
        role,
        updatedAt: DateTime.toDate(DateTime.nowUnsafe()),
        visibility,
      })
      .then(() => undefined),
  );
}

function storedBytes(
  key: string,
): Effect.Effect<Uint8Array | undefined, PhotoStorageFailed, PhotoStore> {
  return Effect.gen(function* readStored() {
    const photo = yield* (yield* PhotoStore).get(key);
    return photo === undefined ? undefined : photo.bytes;
  });
}

it.effect("stores an uploaded JPEG without its EXIF segment and serves it to the owner", () =>
  Effect.gen(function* program() {
    yield* addUser("owner");
    const state = yield* uploadPhoto("owner", PHOTO_SLOT.face, jpegWithExif);
    assert.strictEqual(state.slot, PHOTO_SLOT.face);
    assert.isString(state.version);
    const keys = yield* photoKeysOf("owner");
    assert.strictEqual(keys.face, `photos/owner/face/${state.version ?? ""}`);
    const stored = yield* storedBytes(keys.face ?? "");
    assert.isDefined(stored);
    assert.isFalse(containsExifMarker(stored ?? new Uint8Array()));
    const served = yield* readPhoto("owner", "owner", PHOTO_SLOT.face);
    assert.strictEqual(served.contentType, PHOTO_CONTENT_TYPE.jpeg);
    assert.deepStrictEqual(served.bytes, stored);
  }).pipe(Effect.provide(services)),
);

it.effect("applies the profile visibility to the photo route", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    yield* addUser("hidden", PROFILE_VISIBILITY.self);
    yield* addUser("open");
    yield* uploadPhoto("hidden", PHOTO_SLOT.company, pngWithText);
    yield* uploadPhoto("open", PHOTO_SLOT.company, pngWithText);
    assert.strictEqual(
      yield* failureTag(readPhoto("viewer", "hidden", PHOTO_SLOT.company)),
      "PhotoNotFound",
    );
    assert.strictEqual(
      (yield* readPhoto("hidden", "hidden", PHOTO_SLOT.company)).contentType,
      PHOTO_CONTENT_TYPE.png,
    );
    assert.strictEqual(
      (yield* readPhoto("viewer", "open", PHOTO_SLOT.company)).contentType,
      PHOTO_CONTENT_TYPE.png,
    );
    assert.strictEqual(
      yield* failureTag(readPhoto("viewer", "open", PHOTO_SLOT.face)),
      "PhotoNotFound",
    );
  }).pipe(Effect.provide(services)),
);

it.effect("deletes the previous object when a photo is replaced or removed", () =>
  Effect.gen(function* program() {
    yield* addUser("owner");
    const first = yield* uploadPhoto("owner", PHOTO_SLOT.face, jpegWithExif);
    const second = yield* uploadPhoto("owner", PHOTO_SLOT.face, pngWithText);
    assert.notStrictEqual(first.version, second.version);
    const firstKey = `photos/owner/face/${first.version ?? ""}`;
    const secondKey = `photos/owner/face/${second.version ?? ""}`;
    assert.isUndefined(yield* storedBytes(firstKey));
    assert.isDefined(yield* storedBytes(secondKey));
    const removed = yield* removePhoto("owner", PHOTO_SLOT.face);
    assert.deepStrictEqual(removed, { slot: PHOTO_SLOT.face, version: null });
    assert.isUndefined(yield* storedBytes(secondKey));
    assert.deepStrictEqual(yield* photoKeysOf("owner"), { company: null, face: null });
    assert.deepStrictEqual(yield* removePhoto("owner", PHOTO_SLOT.face), removed);
  }).pipe(Effect.provide(services)),
);

it.effect.each([true, false])(
  "a member withdrawing with immediate=%s leaves no photo behind",
  (immediate) =>
    Effect.gen(function* program() {
      yield* addUser("leaver");
      yield* addUser("stayer");
      const leaverFace = yield* uploadPhoto("leaver", PHOTO_SLOT.face, jpegWithExif);
      const leaverCompany = yield* uploadPhoto("leaver", PHOTO_SLOT.company, pngWithText);
      const kept = yield* uploadPhoto("stayer", PHOTO_SLOT.face, jpegWithExif);
      yield* withdrawWithPhotos("leaver", { immediate });
      assert.isUndefined(yield* storedBytes(`photos/leaver/face/${leaverFace.version ?? ""}`));
      assert.isUndefined(
        yield* storedBytes(`photos/leaver/company/${leaverCompany.version ?? ""}`),
      );
      assert.isDefined(yield* storedBytes(`photos/stayer/face/${kept.version ?? ""}`));
    }).pipe(Effect.provide(services)),
);

const afterRetention = DateTime.toDate(DateTime.makeUnsafe("2100-01-01T00:00:00.000Z"));

function withdrawnRows(memberId: string): Effect.Effect<number, DatabaseFailure, Database> {
  return query((database) =>
    database.select({ memberId: withdrawnMember.memberId }).from(withdrawnMember),
  ).pipe(Effect.map((rows) => rows.filter((row) => row.memberId === memberId).length));
}

const leftBehind = Effect.fn("leftBehind")(function* leftBehind(memberId: string) {
  yield* addUser(memberId);
  const face = yield* uploadPhoto(memberId, PHOTO_SLOT.face, jpegWithExif);
  const company = yield* uploadPhoto(memberId, PHOTO_SLOT.company, pngWithText);
  const store = yield* PhotoStore;
  const photos = yield* Effect.forEach(
    [
      `photos/${memberId}/face/${face.version ?? ""}`,
      `photos/${memberId}/company/${company.version ?? ""}`,
    ],
    (key) => store.get(key).pipe(Effect.map((photo) => ({ key, photo }))),
  );
  yield* withdrawWithPhotos(memberId, { immediate: false });
  const stranded = [
    ...photos,
    { key: `photos/${memberId}/face/unrecorded-upload`, photo: photos[0]?.photo },
  ];
  yield* Effect.forEach(stranded, ({ key, photo }) =>
    photo === undefined ? Effect.void : store.put(key, photo),
  );
  return stranded.map(({ key }) => key);
});

it.effect(
  "the purge after the retention window deletes the photos the withdrawal left behind",
  () =>
    Effect.gen(function* program() {
      const keys = yield* leftBehind("expired");
      yield* addUser("expired2");
      const neighbour = yield* uploadPhoto("expired2", PHOTO_SLOT.face, jpegWithExif);
      for (const key of keys) {
        assert.isDefined(yield* storedBytes(key));
      }
      const purged = yield* purgeWithdrawnWithPhotos(afterRetention);
      assert.deepStrictEqual(purged, { memberIds: ["expired"], retainedMemberIds: [] });
      for (const key of keys) {
        assert.isUndefined(yield* storedBytes(key));
      }
      assert.strictEqual(yield* withdrawnRows("expired"), 0);
      assert.isDefined(yield* storedBytes(`photos/expired2/face/${neighbour.version ?? ""}`));
    }).pipe(Effect.provide(services)),
);

it.effect("keeps the withdrawn record for the next purge when the photos cannot be deleted", () =>
  Effect.gen(function* program() {
    const keys = yield* leftBehind("stuck");
    const purged = yield* purgeWithdrawnWithPhotos(afterRetention).pipe(
      Effect.provide(PhotoStore.fromFileStore().pipe(Layer.provide(FileStore.layer(undefined)))),
    );
    assert.deepStrictEqual(purged, { memberIds: [], retainedMemberIds: ["stuck"] });
    assert.strictEqual(yield* withdrawnRows("stuck"), 1);
    assert.isDefined(yield* storedBytes(keys[0] ?? ""));
    const retried = yield* purgeWithdrawnWithPhotos(afterRetention);
    assert.deepStrictEqual(retried, { memberIds: ["stuck"], retainedMemberIds: [] });
    for (const key of keys) {
      assert.isUndefined(yield* storedBytes(key));
    }
  }).pipe(Effect.provide(services)),
);

it.effect(
  "an immediate withdrawal fails and keeps the member when the photos cannot be deleted",
  () =>
    Effect.gen(function* program() {
      yield* addUser("hasty");
      const face = yield* uploadPhoto("hasty", PHOTO_SLOT.face, jpegWithExif);
      assert.strictEqual(
        yield* failureTag(
          withdrawWithPhotos("hasty", { immediate: true }).pipe(
            Effect.provide(
              PhotoStore.fromFileStore().pipe(Layer.provide(FileStore.layer(undefined))),
            ),
          ),
        ),
        "PhotoStorageFailed",
      );
      assert.deepStrictEqual(yield* photoKeysOf("hasty"), {
        company: null,
        face: `photos/hasty/face/${face.version ?? ""}`,
      });
      assert.isDefined(yield* storedBytes(`photos/hasty/face/${face.version ?? ""}`));
      yield* withdrawWithPhotos("hasty", { immediate: true });
      assert.isUndefined(yield* storedBytes(`photos/hasty/face/${face.version ?? ""}`));
      assert.strictEqual(yield* failureTag(photoKeysOf("hasty")), "UserNotFound");
    }).pipe(Effect.provide(services)),
);

it.effect("a refused withdrawal keeps the photos", () =>
  Effect.gen(function* program() {
    yield* addUser("administrator", PROFILE_VISIBILITY.allMembers, ROLE.administrator);
    const face = yield* uploadPhoto("administrator", PHOTO_SLOT.face, jpegWithExif);
    assert.strictEqual(
      yield* failureTag(withdrawWithPhotos("administrator", { immediate: true })),
      "MemberLeaveUnavailable",
    );
    assert.isDefined(yield* storedBytes(`photos/administrator/face/${face.version ?? ""}`));
  }).pipe(Effect.provide(services)),
);

it.effect("refuses files that are not images and leaves nothing behind", () =>
  Effect.gen(function* program() {
    yield* addUser("owner");
    assert.strictEqual(
      yield* failureTag(
        uploadPhoto("owner", PHOTO_SLOT.face, new TextEncoder().encode("<svg></svg>")),
      ),
      "PhotoUnsupported",
    );
    assert.strictEqual(
      yield* failureTag(uploadPhoto("missing", PHOTO_SLOT.face, jpegWithExif)),
      "UserNotFound",
    );
    assert.deepStrictEqual(yield* photoKeysOf("owner"), { company: null, face: null });
  }).pipe(Effect.provide(services)),
);

function upload(body: BodyInit, headers: Readonly<Record<string, string>>): Request {
  return new Request(`${origin}/api/profile/photo?slot=face`, {
    body,
    headers: { origin, ...headers },
    method: "PUT",
  });
}

it.effect("reads a multipart upload and a raw image body up to the size cap", () =>
  Effect.gen(function* program() {
    const form = new FormData();
    form.append("file", new Blob([jpegWithExif], { type: PHOTO_CONTENT_TYPE.jpeg }), "me.jpg");
    const fromForm = yield* readPhotoUpload(upload(form, {}));
    assert.deepStrictEqual(fromForm, jpegWithExif);
    const raw = yield* readPhotoUpload(
      upload(pngWithText, { "content-type": PHOTO_CONTENT_TYPE.png }),
    );
    assert.deepStrictEqual(raw, pngWithText);
  }).pipe(Effect.provide(services)),
);

it.effect.each([
  {
    body: new Uint8Array(maximumPhotoBytes + 1),
    expected: "PhotoTooLarge",
    headers: { "content-type": PHOTO_CONTENT_TYPE.jpeg },
    name: "an oversize raw body",
  },
  {
    body: "plain text",
    expected: "PhotoUnsupported",
    headers: { "content-type": "text/plain" },
    name: "an unsupported content type",
  },
  {
    body: new Uint8Array(),
    expected: "PhotoMissing",
    headers: { "content-type": PHOTO_CONTENT_TYPE.webp },
    name: "an empty body",
  },
  {
    body: jpegWithExif,
    expected: "RequestRejected",
    headers: { "content-type": PHOTO_CONTENT_TYPE.jpeg, origin: "https://evil.example" },
    name: "a cross-origin request",
  },
])("rejects $name", ({ body, expected, headers }) =>
  Effect.gen(function* program() {
    assert.strictEqual(yield* failureTag(readPhotoUpload(upload(body, headers))), expected);
  }).pipe(Effect.provide(services)),
);

it.effect("rejects an oversize file inside a multipart body", () =>
  Effect.gen(function* program() {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(maximumPhotoBytes + 1)]), "big.bin");
    assert.strictEqual(yield* failureTag(readPhotoUpload(upload(form, {}))), "PhotoTooLarge");
    const empty = new FormData();
    empty.append("note", "no file here");
    assert.strictEqual(yield* failureTag(readPhotoUpload(upload(empty, {}))), "PhotoMissing");
  }).pipe(Effect.provide(services)),
);
