import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { getProfile, updateProfile } from "./profile.ts";
import { addUser, TestDatabase } from "./testing.ts";
import { UserNotFound } from "./user-not-found.ts";

describe("updateProfile", () => {
  describe("a profile written in several scripts", () => {
    const it = test.extend("storedProfile", async () =>
      Effect.runPromise(
        Effect.gen(function* writeUnicode() {
          yield* addUser({ userId: "reader" });
          yield* updateProfile("reader", {
            name: "日本語 العربية 🐈",
            profile: "私は開発者です。",
          });
          return yield* getProfile("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reads back exactly as written", ({ storedProfile }) => {
      expect(storedProfile).toStrictEqual({
        email: "reader@example.com",
        id: "reader",
        name: "日本語 العربية 🐈",
        profile: "私は開発者です。",
      });
    });
  });

  describe("a profile of a user who does not exist", () => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(
        Effect.flip(updateProfile("missing", { name: "missing", profile: "" })).pipe(
          Effect.provide(TestDatabase),
        ),
      ));

    it("is refused", ({ refusal }) => {
      expect(refusal).toStrictEqual(new UserNotFound());
    });
  });
});

describe("getProfile", () => {
  describe("a user who does not exist", () => {
    const it = test.extend("missingProfile", async () =>
      Effect.runPromise(getProfile("missing").pipe(Effect.provide(TestDatabase))));

    it("has no profile", ({ missingProfile }) => {
      expect(missingProfile).toBe(null);
    });
  });
});
