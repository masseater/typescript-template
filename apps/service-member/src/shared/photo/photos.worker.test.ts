import { assert, it } from "@effect/vitest";
import {
  PHOTO_CONTENT_TYPE,
  PHOTO_SLOT,
  PROFILE_VISIBILITY,
  ROLE,
  maximumPhotoBytes,
} from "@repo/config";
import { readStorage } from "@repo/config/storage";
import { photoKeysOf, query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { AppOrigin } from "@repo/runtime/http";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { containsExifMarker, jpegWithExif, pngWithText } from "./image-fixture.ts";
import { PhotoStore } from "./photo-store.ts";
import { deleteMemberPhotos, readPhoto, removePhoto, uploadPhoto } from "./photos.ts";
import { readPhotoUpload } from "./upload.ts";

import type { R2Bucket } from "@cloudflare/workers-types";
import type { ProfileVisibility } from "@repo/config";
import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;
const origin = "http://localhost:3001";

const bucket: R2Bucket = await Effect.runPromise(
  Effect.map(readStorage(env), (found) => {
    if (found === undefined) {
      throw new TypeError("the worker test pool has no PHOTOS bucket");
    }
    return found;
  }),
);

const services = Layer.mergeAll(
  TestDatabase,
  PhotoStore.layer(bucket),
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

function storedKeys(): Effect.Effect<readonly string[]> {
  return Effect.promise(async () => {
    const listed = await bucket.list();
    return listed.objects.map((object) => object.key);
  });
}

function clearBucket(): Effect.Effect<void> {
  return Effect.flatMap(storedKeys(), (keys) =>
    Effect.promise(async () => {
      await bucket.delete([...keys]);
    }),
  );
}

function storedBytes(key: string): Effect.Effect<Uint8Array | undefined> {
  return Effect.promise(async () => {
    const object = await bucket.get(key);
    return object === null ? undefined : new Uint8Array(await object.arrayBuffer());
  });
}

it.effect("stores an uploaded JPEG without its EXIF segment and serves it to the owner", () =>
  Effect.gen(function* program() {
    yield* clearBucket();
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
    yield* clearBucket();
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
    yield* clearBucket();
    yield* addUser("owner");
    const first = yield* uploadPhoto("owner", PHOTO_SLOT.face, jpegWithExif);
    const second = yield* uploadPhoto("owner", PHOTO_SLOT.face, pngWithText);
    assert.notStrictEqual(first.version, second.version);
    assert.deepStrictEqual(yield* storedKeys(), [`photos/owner/face/${second.version ?? ""}`]);
    const removed = yield* removePhoto("owner", PHOTO_SLOT.face);
    assert.deepStrictEqual(removed, { slot: PHOTO_SLOT.face, version: null });
    assert.deepStrictEqual(yield* storedKeys(), []);
    assert.deepStrictEqual(yield* photoKeysOf("owner"), { company: null, face: null });
    assert.deepStrictEqual(yield* removePhoto("owner", PHOTO_SLOT.face), removed);
  }).pipe(Effect.provide(services)),
);

it.effect("deleteMemberPhotos clears both slots and their objects", () =>
  Effect.gen(function* program() {
    yield* clearBucket();
    yield* addUser("leaver");
    yield* addUser("stayer");
    yield* uploadPhoto("leaver", PHOTO_SLOT.face, jpegWithExif);
    yield* uploadPhoto("leaver", PHOTO_SLOT.company, pngWithText);
    const kept = yield* uploadPhoto("stayer", PHOTO_SLOT.face, jpegWithExif);
    assert.strictEqual(yield* deleteMemberPhotos("leaver"), 2);
    assert.deepStrictEqual(yield* photoKeysOf("leaver"), { company: null, face: null });
    assert.deepStrictEqual(yield* storedKeys(), [`photos/stayer/face/${kept.version ?? ""}`]);
    assert.strictEqual(yield* deleteMemberPhotos("leaver"), 0);
    assert.strictEqual(yield* failureTag(deleteMemberPhotos("missing")), "UserNotFound");
  }).pipe(Effect.provide(services)),
);

it.effect("refuses files that are not images and leaves nothing behind", () =>
  Effect.gen(function* program() {
    yield* clearBucket();
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
    assert.deepStrictEqual(yield* storedKeys(), []);
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
