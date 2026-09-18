import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { query } from "./database.ts";
import { getMember, listMembers } from "./members.ts";
import { user } from "./schema.ts";
import { addUser, TestDatabase } from "./testing.ts";
import { UserNotFound } from "./user-not-found.ts";

describe("getMember", () => {
  describe("another verified member", () => {
    const it = test.extend("shownMember", async () =>
      Effect.runPromise(
        Effect.gen(function* viewOther() {
          yield* addUser({ userId: "viewer" });
          yield* addUser({ userId: "reader" });
          yield* query(async (database): Promise<void> => {
            await database
              .update(user)
              .set({
                createdAt: new Date("2026-08-31T23:59:59.999Z"),
                name: "山田 花子",
                profile: "はじめまして。",
              })
              .where(eq(user.id, "reader"));
          });
          return yield* getMember("viewer", "reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("shows only what the profile page shows to others", ({ shownMember }) => {
      expect(shownMember).toStrictEqual({
        id: "reader",
        joined: "2026-08",
        name: "山田 花子",
        profile: "はじめまして。",
      });
    });
  });

  describe("an unverified member opened by someone else", () => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(
        Effect.gen(function* viewPending() {
          yield* addUser({ userId: "viewer" });
          yield* addUser({ emailVerified: false, userId: "pending" });
          return yield* Effect.flip(getMember("viewer", "pending"));
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is answered as missing", ({ refusal }) => {
      expect(refusal).toStrictEqual(new UserNotFound());
    });
  });

  describe("an unverified member opened by themselves", () => {
    const it = test.extend("shownMember", async () =>
      Effect.runPromise(
        Effect.gen(function* viewSelf() {
          yield* addUser({ emailVerified: false, userId: "pending" });
          yield* query(async (database): Promise<void> => {
            await database
              .update(user)
              .set({ createdAt: new Date("2026-09-01T00:00:00.000Z") })
              .where(eq(user.id, "pending"));
          });
          return yield* getMember("pending", "pending");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is shown", ({ shownMember }) => {
      expect(shownMember).toStrictEqual({
        id: "pending",
        joined: "2026-09",
        name: "pending",
        profile: "",
      });
    });
  });

  describe("a member who does not exist", () => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(
        Effect.gen(function* viewMissing() {
          yield* addUser({ userId: "viewer" });
          return yield* Effect.flip(getMember("viewer", "missing"));
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is answered the same way as one the viewer may not open", ({ refusal }) => {
      expect(refusal).toStrictEqual(new UserNotFound());
    });
  });
});

describe("listMembers", () => {
  describe("verified members and one unverified member", () => {
    const it = test.extend("memberPage", async () =>
      Effect.runPromise(
        Effect.gen(function* listAll() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values(
              [
                {
                  createdAt: "2026-07-01T00:00:00.000Z",
                  id: "old",
                  name: "古参",
                  profile: "最初の利用者",
                  verified: true,
                },
                {
                  createdAt: "2026-09-01T00:00:00.000Z",
                  id: "new",
                  name: "新人",
                  profile: "",
                  verified: true,
                },
                {
                  createdAt: "2026-08-01T00:00:00.000Z",
                  id: "pending",
                  name: "未確認",
                  profile: "",
                  verified: false,
                },
              ].map((seeded) => ({
                createdAt: new Date(seeded.createdAt),
                email: `${seeded.id}@example.com`,
                emailVerified: seeded.verified,
                id: seeded.id,
                name: seeded.name,
                profile: seeded.profile,
                updatedAt: new Date(seeded.createdAt),
              })),
            );
          });
          return yield* listMembers({ limit: 24, offset: 0 });
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("lists the verified members newest first with only what others may see", ({
      memberPage,
    }) => {
      expect(memberPage).toStrictEqual({
        members: [
          { id: "new", joined: "2026-09", name: "新人", profile: "" },
          { id: "old", joined: "2026-07", name: "古参", profile: "最初の利用者" },
        ],
        total: 2,
      });
    });
  });

  describe.for([
    ["花子", [{ id: "a", joined: "2026-09", name: "山田 花子", profile: "" }]],
    ["USER", [{ id: "c", joined: "2026-09", name: "100%_user", profile: "" }]],
    ["%", [{ id: "c", joined: "2026-09", name: "100%_user", profile: "" }]],
    ["_", [{ id: "c", joined: "2026-09", name: "100%_user", profile: "" }]],
  ] as const)("a search for %s", ([keyword, expectedMembers]) => {
    const it = test.extend("memberPage", async () =>
      Effect.runPromise(
        Effect.gen(function* search() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values(
              [
                { createdAt: "2026-09-03T00:00:00.000Z", id: "a", name: "山田 花子", profile: "" },
                {
                  createdAt: "2026-09-02T00:00:00.000Z",
                  id: "b",
                  name: "山本 太郎",
                  profile: "花子の友人",
                },
                { createdAt: "2026-09-01T00:00:00.000Z", id: "c", name: "100%_user", profile: "" },
              ].map((seeded) => ({
                createdAt: new Date(seeded.createdAt),
                email: `${seeded.id}@example.com`,
                emailVerified: true,
                id: seeded.id,
                name: seeded.name,
                profile: seeded.profile,
                updatedAt: new Date(seeded.createdAt),
              })),
            );
          });
          return yield* listMembers({ keyword, limit: 24, offset: 0 });
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("matches a part of the name ignoring case and treats wildcards as text", ({
      memberPage,
    }) => {
      expect(memberPage).toStrictEqual({ members: expectedMembers, total: 1 });
    });
  });

  describe.for([
    [2, [{ id: "first", joined: "2026-09", name: "member 1", profile: "" }]],
    [4, []],
  ] as const)("the page from offset %i over three members", ([offset, expectedMembers]) => {
    const it = test.extend("memberPage", async () =>
      Effect.runPromise(
        Effect.gen(function* pageThrough() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values(
              [
                { createdAt: "2026-09-03T00:00:00.000Z", id: "third", name: "member 3" },
                { createdAt: "2026-09-02T00:00:00.000Z", id: "second", name: "member 2" },
                { createdAt: "2026-09-01T00:00:00.000Z", id: "first", name: "member 1" },
              ].map((seeded) => ({
                createdAt: new Date(seeded.createdAt),
                email: `${seeded.id}@example.com`,
                emailVerified: true,
                id: seeded.id,
                name: seeded.name,
                updatedAt: new Date(seeded.createdAt),
              })),
            );
          });
          return yield* listMembers({ limit: 2, offset });
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reports the total beyond the page", ({ memberPage }) => {
      expect(memberPage).toStrictEqual({ members: expectedMembers, total: 3 });
    });
  });

  describe("members who registered at the same moment", () => {
    const it = test.extend("memberPage", async () =>
      Effect.runPromise(
        Effect.gen(function* sameMoment() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values(
              [
                { id: "b", name: "second by id" },
                { id: "a", name: "first by id" },
              ].map((seeded) => ({
                createdAt: new Date("2026-09-01T00:00:00.000Z"),
                email: `${seeded.id}@example.com`,
                emailVerified: true,
                id: seeded.id,
                name: seeded.name,
                updatedAt: new Date("2026-09-01T00:00:00.000Z"),
              })),
            );
          });
          return yield* listMembers({ limit: 24, offset: 0 });
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("are ordered by id", ({ memberPage }) => {
      expect(memberPage).toStrictEqual({
        members: [
          { id: "a", joined: "2026-09", name: "first by id", profile: "" },
          { id: "b", joined: "2026-09", name: "second by id", profile: "" },
        ],
        total: 2,
      });
    });
  });
});
