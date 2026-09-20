import { assert, it } from "@effect/vitest";
import { PHOTO_SLOT, PROFILE_VISIBILITY, ROLE } from "@repo/config";
import { Effect } from "effect";

import {
  canViewProfile,
  clearPhotoKeys,
  photoKeysOf,
  readVisibility,
  setPhotoKey,
  updateVisibility,
  visiblePhotoKey,
} from "./member-profile.ts";
import { addUser } from "./records-fixture.ts";
import { TestDatabase } from "./testing.ts";

it.effect("a profile kept to oneself is readable by its owner and by nobody else", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ userId: "hidden", visibility: PROFILE_VISIBILITY.self });
    yield* addUser({ userId: "open" });
    assert.isTrue(yield* canViewProfile("hidden", "hidden"));
    assert.isFalse(yield* canViewProfile("viewer", "hidden"));
    assert.isTrue(yield* canViewProfile("viewer", "open"));
    assert.isTrue(yield* canViewProfile("viewer", "viewer"));
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("unverified members and administrators are not open profiles", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ emailVerified: false, userId: "unverified" });
    yield* addUser({ role: ROLE.administrator, userId: "operator" });
    assert.isFalse(yield* canViewProfile("viewer", "unverified"));
    assert.isFalse(yield* canViewProfile("viewer", "operator"));
    assert.isTrue(yield* canViewProfile("unverified", "unverified"));
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("visibility defaults to every member without a search listing", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "member" });
    assert.deepStrictEqual(yield* readVisibility("member"), {
      searchable: false,
      visibility: PROFILE_VISIBILITY.members,
    });
    const updated = yield* updateVisibility("member", {
      searchable: true,
      visibility: PROFILE_VISIBILITY.self,
    });
    assert.deepStrictEqual(updated, { searchable: true, visibility: PROFILE_VISIBILITY.self });
    assert.deepStrictEqual(yield* readVisibility("member"), updated);
    const missing = yield* readVisibility("nobody").pipe(Effect.flip);
    assert.strictEqual(missing._tag, "UserNotFound");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("a photo key is served only to viewers who may open the profile", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "viewer" });
    yield* addUser({ userId: "hidden", visibility: PROFILE_VISIBILITY.self });
    assert.isNull(yield* setPhotoKey("hidden", PHOTO_SLOT.face, "photos/hidden/face/1"));
    assert.strictEqual(
      yield* visiblePhotoKey("hidden", "hidden", PHOTO_SLOT.face),
      "photos/hidden/face/1",
    );
    assert.isUndefined(yield* visiblePhotoKey("viewer", "hidden", PHOTO_SLOT.face));
    assert.isUndefined(yield* visiblePhotoKey("hidden", "hidden", PHOTO_SLOT.company));
    assert.strictEqual(
      yield* setPhotoKey("hidden", PHOTO_SLOT.face, "photos/hidden/face/2"),
      "photos/hidden/face/1",
    );
    yield* setPhotoKey("hidden", PHOTO_SLOT.company, "photos/hidden/company/1");
    assert.deepStrictEqual(yield* clearPhotoKeys("hidden"), {
      company: "photos/hidden/company/1",
      face: "photos/hidden/face/2",
    });
    assert.deepStrictEqual(yield* photoKeysOf("hidden"), { company: null, face: null });
  }).pipe(Effect.provide(TestDatabase)),
);
