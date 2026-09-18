import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { MemberList, MemberListQuery, MemberView, maximumMemberPage } from "./contracts.ts";

const encode = Schema.encodeUnknownEffect(MemberView);

describe("member view", () => {
  it.effect("drops everything the profile page does not show to others", () =>
    Effect.gen(function* program() {
      const encoded = yield* encode({
        email: "reader@example.com",
        emailVerified: true,
        id: "reader",
        joined: "2026-08",
        name: "山田 花子",
        profile: "はじめまして。",
        role: "admin",
        twoFactorEnabled: true,
      });
      assert.deepStrictEqual(encoded, {
        id: "reader",
        joined: "2026-08",
        name: "山田 花子",
        profile: "はじめまして。",
      });
    }),
  );

  it.effect("rejects a registration date finer than a month", () =>
    Effect.gen(function* program() {
      const failure = yield* encode({
        id: "reader",
        joined: "2026-08-31T23:59:59.999Z",
        name: "reader",
        profile: "",
      }).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "SchemaError");
    }),
  );
});

const decodeQuery = Schema.decodeUnknownEffect(MemberListQuery, { onExcessProperty: "error" });

describe("member list query", () => {
  it.effect("reads the first page when the query carries nothing", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* decodeQuery({}), { page: 1 });
    }),
  );

  it.effect("reads the last page it serves and nothing beyond it", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* decodeQuery({ page: String(maximumMemberPage) }), {
        page: maximumMemberPage,
      });
      const failure = yield* decodeQuery({ page: String(maximumMemberPage + 1) }).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "SchemaError");
    }),
  );

  it.effect("reads a trimmed name and a page from the query string", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* decodeQuery({ keyword: " 花子 ", page: "3" }), {
        keyword: "花子",
        page: 3,
      });
    }),
  );

  it.effect.each([
    { page: "0" },
    { page: "1.5" },
    { page: "abc" },
    { keyword: "" },
    { keyword: "   " },
    { limit: "500" },
  ])("rejects the query %o", (input) =>
    Effect.gen(function* program() {
      const failure = yield* decodeQuery(input).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "SchemaError");
    }),
  );
});

describe("member list response", () => {
  it.effect("drops private fields from every listed member", () =>
    Effect.gen(function* program() {
      const encoded = yield* Schema.encodeUnknownEffect(MemberList)({
        members: [
          {
            email: "a@example.com",
            id: "a",
            joined: "2026-09",
            name: "a",
            profile: "",
            role: "admin",
          },
        ],
        pageSize: 24,
        total: 1,
      });
      assert.deepStrictEqual(encoded, {
        members: [{ id: "a", joined: "2026-09", name: "a", profile: "" }],
        pageSize: 24,
        total: 1,
      });
    }),
  );
});
