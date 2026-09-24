import { PHOTO_SLOT, PROFILE_VISIBILITY, ROLE } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  canViewProfile,
  photoKeysOf,
  readVisibility,
  setPhotoKey,
  updateVisibility,
  visiblePhotoKey,
} from "./member-profile.ts";
import { addUser } from "./records-test-fixture.ts";
import { TestDatabase } from "./database-test-fixture.ts";
import { UserNotFound } from "./user-not-found.ts";

describe("canViewProfile among open and self-only profiles", () => {
  describe.for([
    ["the owner of a profile kept to oneself", "hidden", "hidden", true],
    ["another member looking at a profile kept to oneself", "viewer", "hidden", false],
    ["a member looking at an open profile", "viewer", "open", true],
    ["a member looking at their own open profile", "viewer", "viewer", true],
  ] as const)("%s", ([, viewerId, targetId, visible]) => {
    const it = test.extend("profileViewable", () =>
      Effect.runPromise(
        Effect.gen(function* viewKeptProfile() {
          yield* addUser({ userId: "viewer" });
          yield* addUser({ userId: "hidden", visibility: PROFILE_VISIBILITY.self });
          yield* addUser({ userId: "open" });
          return yield* canViewProfile(viewerId, targetId);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("decides whether the viewer may open the profile", ({ profileViewable }) => {
      expect(profileViewable).toBe(visible);
    });
  });
});

describe("canViewProfile outside the open member directory", () => {
  describe.for([
    ["a member looking at an unverified member", "viewer", "unverified", false],
    ["a member looking at an administrator", "viewer", "operator", false],
    ["an unverified member looking at their own profile", "unverified", "unverified", true],
  ] as const)("%s", ([, viewerId, targetId, visible]) => {
    const it = test.extend("profileViewable", () =>
      Effect.runPromise(
        Effect.gen(function* viewClosedProfile() {
          yield* addUser({ userId: "viewer" });
          yield* addUser({ emailVerified: false, userId: "unverified" });
          yield* addUser({ role: ROLE.administrator, userId: "operator" });
          return yield* canViewProfile(viewerId, targetId);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("decides whether the viewer may open the profile", ({ profileViewable }) => {
      expect(profileViewable).toBe(visible);
    });
  });
});

describe("readVisibility", () => {
  describe("a member who never changed their visibility", () => {
    const it = test.extend("visibilitySettings", () =>
      Effect.runPromise(
        Effect.gen(function* readDefault() {
          yield* addUser({ userId: "member" });
          return yield* readVisibility("member");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is visible to every member without a search listing", ({ visibilitySettings }) => {
      expect(visibilitySettings).toStrictEqual({
        searchable: false,
        visibility: PROFILE_VISIBILITY.allMembers,
      });
    });
  });

  describe("a member who changed their visibility", () => {
    const it = test.extend("visibilitySettings", () =>
      Effect.runPromise(
        Effect.gen(function* readChanged() {
          yield* addUser({ userId: "member" });
          yield* updateVisibility("member", {
            searchable: true,
            visibility: PROFILE_VISIBILITY.self,
          });
          return yield* readVisibility("member");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reads back the saved settings", ({ visibilitySettings }) => {
      expect(visibilitySettings).toStrictEqual({
        searchable: true,
        visibility: PROFILE_VISIBILITY.self,
      });
    });
  });

  describe("a user who does not exist", () => {
    const it = test.extend("visibilityFailure", () =>
      Effect.runPromise(readVisibility("nobody").pipe(Effect.flip, Effect.provide(TestDatabase))));

    it("is refused as not found", ({ visibilityFailure }) => {
      expect(visibilityFailure).toStrictEqual(new UserNotFound());
    });
  });
});

describe("updateVisibility", () => {
  const it = test.extend("savedSettings", () =>
    Effect.runPromise(
      Effect.gen(function* saveVisibility() {
        yield* addUser({ userId: "member" });
        return yield* updateVisibility("member", {
          searchable: true,
          visibility: PROFILE_VISIBILITY.self,
        });
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("hands back the saved settings", ({ savedSettings }) => {
    expect(savedSettings).toStrictEqual({ searchable: true, visibility: PROFILE_VISIBILITY.self });
  });
});

describe("setPhotoKey", () => {
  describe("the first photo in a slot", () => {
    const it = test.extend("replacedPhotoKey", () =>
      Effect.runPromise(
        Effect.gen(function* setFirstPhoto() {
          yield* addUser({ userId: "hidden", visibility: PROFILE_VISIBILITY.self });
          return yield* setPhotoKey({
            memberId: "hidden",
            photoKey: "photos/hidden/face/1",
            slot: PHOTO_SLOT.face,
          });
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("replaces no earlier photo", ({ replacedPhotoKey }) => {
      expect(replacedPhotoKey).toBe(null);
    });
  });

  describe("a second photo in the same slot", () => {
    const it = test.extend("replacedPhotoKey", () =>
      Effect.runPromise(
        Effect.gen(function* setSecondPhoto() {
          yield* addUser({ userId: "hidden", visibility: PROFILE_VISIBILITY.self });
          yield* setPhotoKey({
            memberId: "hidden",
            photoKey: "photos/hidden/face/1",
            slot: PHOTO_SLOT.face,
          });
          return yield* setPhotoKey({
            memberId: "hidden",
            photoKey: "photos/hidden/face/2",
            slot: PHOTO_SLOT.face,
          });
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("hands back the photo it replaced", ({ replacedPhotoKey }) => {
      expect(replacedPhotoKey).toBe("photos/hidden/face/1");
    });
  });
});

describe("visiblePhotoKey", () => {
  describe.for([
    ["the owner reading a slot with a photo", "hidden", PHOTO_SLOT.face, "photos/hidden/face/1"],
    ["another member reading a slot with a photo", "viewer", PHOTO_SLOT.face, undefined],
    ["the owner reading an empty slot", "hidden", PHOTO_SLOT.company, undefined],
  ] as const)("%s", ([, viewerId, slot, servedPhotoKey]) => {
    const it = test.extend("visibleKey", () =>
      Effect.runPromise(
        Effect.gen(function* readPhoto() {
          yield* addUser({ userId: "viewer" });
          yield* addUser({ userId: "hidden", visibility: PROFILE_VISIBILITY.self });
          yield* setPhotoKey({
            memberId: "hidden",
            photoKey: "photos/hidden/face/1",
            slot: PHOTO_SLOT.face,
          });
          return yield* visiblePhotoKey({ memberId: "hidden", slot, viewerId });
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("serves only what the viewer may open", ({ visibleKey }) => {
      expect(visibleKey).toBe(servedPhotoKey);
    });
  });
});

describe("photoKeysOf", () => {
  const it = test.extend("storedPhotoKeys", () =>
    Effect.runPromise(
      Effect.gen(function* storePhotos() {
        yield* addUser({ userId: "hidden", visibility: PROFILE_VISIBILITY.self });
        yield* setPhotoKey({
          memberId: "hidden",
          photoKey: "photos/hidden/face/1",
          slot: PHOTO_SLOT.face,
        });
        yield* setPhotoKey({
          memberId: "hidden",
          photoKey: "photos/hidden/face/2",
          slot: PHOTO_SLOT.face,
        });
        yield* setPhotoKey({
          memberId: "hidden",
          photoKey: "photos/hidden/company/1",
          slot: PHOTO_SLOT.company,
        });
        return yield* photoKeysOf("hidden");
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("holds the latest photo of every slot", ({ storedPhotoKeys }) => {
    expect(storedPhotoKeys).toStrictEqual({
      company: "photos/hidden/company/1",
      face: "photos/hidden/face/2",
    });
  });
});
