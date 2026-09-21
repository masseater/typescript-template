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
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { containsExifMarker, jpegWithExif, pngWithText } from "./image-fixture.ts";
import { PhotoStore } from "./photo-store.ts";
import { deleteMemberPhotos, readPhoto, removePhoto, uploadPhoto } from "./photos.ts";
import { readPhotoUpload } from "./upload.ts";

import type { ProfileVisibility } from "@repo/config";
import type { Database, DatabaseFailure } from "@repo/db";
import type { PhotoStorageFailed } from "./photo-storage-failed.ts";

const { user } = schema;
const origin = "http://localhost:3001";

const services = Layer.mergeAll(
  TestDatabase,
  PhotoStore.fromFileStore().pipe(Layer.provide(Layer.orDie(FileStore.fromEnvironment(env)))),
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
): Effect.Effect<void, DatabaseFailure, Database> {
  return query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date(),
      email: `${id}@example.com`,
      emailVerified: true,
      id,
      name: id,
      role: ROLE.member,
      updatedAt: new Date(),
      visibility,
    });
  });
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

it.effect("deleteMemberPhotos clears both slots and their objects", () =>
  Effect.gen(function* program() {
    yield* addUser("leaver");
    yield* addUser("stayer");
    const leaverFace = yield* uploadPhoto("leaver", PHOTO_SLOT.face, jpegWithExif);
    const leaverCompany = yield* uploadPhoto("leaver", PHOTO_SLOT.company, pngWithText);
    const kept = yield* uploadPhoto("stayer", PHOTO_SLOT.face, jpegWithExif);
    const leaverFaceKey = `photos/leaver/face/${leaverFace.version ?? ""}`;
    const leaverCompanyKey = `photos/leaver/company/${leaverCompany.version ?? ""}`;
    const stayerKey = `photos/stayer/face/${kept.version ?? ""}`;
    assert.strictEqual(yield* deleteMemberPhotos("leaver"), 2);
    assert.deepStrictEqual(yield* photoKeysOf("leaver"), { company: null, face: null });
    assert.isUndefined(yield* storedBytes(leaverFaceKey));
    assert.isUndefined(yield* storedBytes(leaverCompanyKey));
    assert.isDefined(yield* storedBytes(stayerKey));
    assert.strictEqual(yield* deleteMemberPhotos("leaver"), 0);
    assert.strictEqual(yield* failureTag(deleteMemberPhotos("missing")), "UserNotFound");
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
