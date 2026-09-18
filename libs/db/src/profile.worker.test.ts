import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { getProfile, updateProfile } from "./profile.ts";
import { addUser, runTest } from "./testing.ts";
import { UserNotFound } from "./user-not-found.ts";

describe("updateProfile", () => {
  describe("a profile written in several scripts", () => {
    const it = test.extend("storedProfile", async () =>
      runTest(
        Effect.gen(function* writeUnicode() {
          yield* addUser({ userId: "reader" });
          yield* updateProfile("reader", {
            name: "日本語 العربية 🐈",
            profile: "私は開発者です。",
          });
          return yield* getProfile("reader");
        }),
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
      runTest(Effect.flip(updateProfile("missing", { name: "missing", profile: "" }))));

    it("is refused", ({ refusal }) => {
      expect(refusal).toStrictEqual(new UserNotFound());
    });
  });
});

describe("getProfile", () => {
  describe("a user who does not exist", () => {
    const it = test.extend("missingProfile", async () => runTest(getProfile("missing")));

    it("has no profile", ({ missingProfile }) => {
      expect(missingProfile).toBe(null);
    });
  });
});
