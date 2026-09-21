import { assert, it } from "@effect/vitest";
import { PROFILE_VISIBILITY, ROLE } from "@repo/config";
import { blockMember, query, schema, setPhotoKey } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";

import { getMember, getProfile, listMembers, updateProfile } from "./members.ts";

import type { ProfileVisibility } from "@repo/config";
import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;
const firstPage = { limit: 24, offset: 0 };

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
  settings: Readonly<{ searchable?: boolean; visibility?: ProfileVisibility }> = {},
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
      ...settings,
    });
  });
}

it.effect("shows another member only when their profile is open to members", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    yield* addUser("hidden", { searchable: true, visibility: PROFILE_VISIBILITY.self });
    yield* addUser("open", { searchable: true });
    yield* setPhotoKey("open", "face", "members/open/face/v1");
    assert.strictEqual(yield* failureTag(getMember("viewer", "hidden")), "UserNotFound");
    assert.strictEqual((yield* getMember("hidden", "hidden")).id, "hidden");
    const open = yield* getMember("viewer", "open");
    assert.deepStrictEqual(open.photos, { company: null, face: "v1" });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("lists only open profiles that asked to be listed", () =>
  Effect.gen(function* program() {
    yield* addUser("hidden", { searchable: true, visibility: PROFILE_VISIBILITY.self });
    yield* addUser("unlisted");
    yield* addUser("listed", { searchable: true });
    const page = yield* listMembers("listed", firstPage);
    assert.deepStrictEqual(
      page.members.map((member) => member.id),
      ["listed"],
    );
    assert.strictEqual(page.total, 1);
    const searched = yield* listMembers("listed", { ...firstPage, keyword: "hidden" });
    assert.strictEqual(searched.total, 0);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("hides a profile from the person who was blocked, and redacts it for the blocker", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    yield* addUser("guard", { searchable: true });
    yield* addUser("quiet", { searchable: true });
    yield* blockMember("guard", "viewer");
    yield* blockMember("viewer", "quiet");
    assert.strictEqual(yield* failureTag(getMember("viewer", "guard")), "UserNotFound");
    const redacted = yield* getMember("viewer", "quiet");
    assert.strictEqual(redacted.blocked, true);
    assert.strictEqual(redacted.profile, "");
    const page = yield* listMembers("viewer", firstPage);
    assert.deepStrictEqual(
      page.members.map((member) => member.id),
      [],
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("persists Unicode profiles", () =>
  Effect.gen(function* program() {
    yield* addUser("reader");
    yield* updateProfile("reader", {
      name: "日本語 العربية 🐈",
      profile: "私は開発者です。",
      socialLinks: ["https://github.com/reader"],
    });
    const profile = yield* getProfile("reader");
    assert.strictEqual(profile?.name, "日本語 العربية 🐈");
    assert.strictEqual(profile?.profile, "私は開発者です。");
    assert.deepStrictEqual(profile?.socialLinks, ["https://github.com/reader"]);
    assert.strictEqual(
      yield* failureTag(
        updateProfile("missing", { name: "missing", profile: "", socialLinks: [] }),
      ),
      "UserNotFound",
    );
  }).pipe(Effect.provide(TestDatabase)),
);
