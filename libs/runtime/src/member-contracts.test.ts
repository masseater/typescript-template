import { Effect, Schema } from "effect";
import { assert, describe, it } from "@effect/vitest";
import { MemberView } from "./contracts.ts";

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
