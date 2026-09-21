import { assert, it } from "@effect/vitest";
import { PROFILE_VISIBILITY, ROLE, SUBSCRIPTION_STATUS } from "@repo/config";
import { query, recordSubscription, schema, setPhotoKey } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { getMember, getProfile, searchMembers, updateProfile } from "./members.ts";

import type { ProfileVisibility } from "@repo/config";
import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;
const firstPage = { limit: 24, offset: 0 };
const monthLater = new Date("2026-10-20T00:00:00.000Z");

const makePaid = Effect.fn("makePaid")(function* makePaid(memberId: string) {
  yield* TestClock.setTime(new Date("2026-09-20T00:00:00.000Z").getTime());
  yield* recordSubscription(
    { createdAt: new Date("2026-09-20T00:00:00.000Z"), id: `evt_${memberId}`, type: "updated" },
    {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: monthLater,
      memberId,
      status: SUBSCRIPTION_STATUS.active,
      stripeCustomerId: `cus_${memberId}`,
      stripeSubscriptionId: `sub_${memberId}`,
    },
  );
});

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
    yield* addUser("paid");
    yield* makePaid("paid");
    yield* addUser("hidden", { searchable: true, visibility: PROFILE_VISIBILITY.self });
    yield* addUser("unlisted");
    yield* addUser("listed", { searchable: true });
    const page = yield* searchMembers("paid", firstPage);
    assert.deepStrictEqual(
      page.members.map((member) => member.id),
      ["listed"],
    );
    assert.strictEqual(page.total, 1);
    const searched = yield* searchMembers("paid", { ...firstPage, keyword: "hidden" });
    assert.strictEqual(searched.total, 0);
    const named = yield* searchMembers("paid", { ...firstPage, keyword: "listed" });
    assert.deepStrictEqual(
      named.members.map((member) => member.id),
      ["listed"],
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("keeps unverified, withdrawn, and non-member accounts out of search", () =>
  Effect.gen(function* program() {
    yield* addUser("paid");
    yield* makePaid("paid");
    yield* addUser("listed", { searchable: true });
    yield* query(async (database) => {
      await database.insert(user).values({
        createdAt: new Date(),
        email: "unverified@example.com",
        emailVerified: false,
        id: "unverified",
        name: "unverified",
        role: ROLE.member,
        searchable: true,
        updatedAt: new Date(),
      });
      await database.insert(user).values({
        createdAt: new Date(),
        email: "operator@example.com",
        emailVerified: true,
        id: "operator",
        name: "operator",
        role: ROLE.administrator,
        searchable: true,
        updatedAt: new Date(),
      });
    });
    yield* query(async (database) => {
      await database.delete(user).where(eq(user.id, "listed"));
    });
    yield* addUser("visible", { searchable: true });
    const page = yield* searchMembers("paid", { ...firstPage, keyword: "unverified" });
    assert.strictEqual(page.total, 0);
    const operators = yield* searchMembers("paid", { ...firstPage, keyword: "operator" });
    assert.strictEqual(operators.total, 0);
    const visible = yield* searchMembers("paid", firstPage);
    assert.deepStrictEqual(
      visible.members.map((member) => member.id),
      ["visible"],
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("lets only a paid member search, and still hides opted-out profiles", () =>
  Effect.gen(function* program() {
    yield* addUser("free");
    yield* addUser("paid");
    yield* makePaid("paid");
    yield* addUser("hidden", { searchable: true, visibility: PROFILE_VISIBILITY.self });
    yield* addUser("unlisted");
    yield* addUser("listed", { searchable: true });
    assert.strictEqual(yield* failureTag(searchMembers("free", firstPage)), "PaidPlanRequired");
    const named = yield* searchMembers("paid", { ...firstPage, keyword: "listed" });
    assert.deepStrictEqual(
      named.members.map((member) => member.id),
      ["listed"],
    );
    const closed = yield* searchMembers("paid", { ...firstPage, keyword: "hidden" });
    assert.strictEqual(closed.total, 0);
    const unlisted = yield* searchMembers("paid", { ...firstPage, keyword: "unlisted" });
    assert.strictEqual(unlisted.total, 0);
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
