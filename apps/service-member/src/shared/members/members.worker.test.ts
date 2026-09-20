import { assert, it } from "@effect/vitest";
import { PROFILE_VISIBILITY, ROLE, SUBSCRIPTION_STATUS } from "@repo/config";
import { query, recordSubscription, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";

import { listMembers } from "./members.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;
const recordedAt = new Date("2026-01-02T00:00:00.000Z");
const pageSize = 24;
const monthLater = new Date("2026-10-20T00:00:00.000Z");

const addUser = (added: {
  readonly createdAt?: Date;
  readonly emailVerified?: boolean;
  readonly name?: string;
  readonly role?: typeof ROLE.member | typeof ROLE.administrator;
  readonly searchable?: boolean;
  readonly userId: string;
  readonly visibility?: typeof PROFILE_VISIBILITY.allMembers | typeof PROFILE_VISIBILITY.self;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: added.createdAt ?? recordedAt,
      email: `${added.userId}@example.com`,
      emailVerified: added.emailVerified ?? true,
      id: added.userId,
      name: added.name ?? added.userId,
      role: added.role ?? ROLE.member,
      searchable: added.searchable ?? false,
      updatedAt: recordedAt,
      visibility: added.visibility ?? PROFILE_VISIBILITY.allMembers,
    });
  });

const addPaid = (memberId: string) =>
  recordSubscription(
    { createdAt: recordedAt, id: `evt_${memberId}`, type: "customer.subscription.updated" },
    {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: monthLater,
      memberId,
      status: SUBSCRIPTION_STATUS.active,
      stripeCustomerId: `cus_${memberId}`,
      stripeSubscriptionId: `sub_${memberId}`,
    },
  );

it.effect("lists searchable open profiles newest first and filters by keyword", () =>
  Effect.gen(function* program() {
    yield* addUser({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      name: "Alice Alpha",
      searchable: true,
      userId: "alice",
    });
    yield* addUser({
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      name: "Bob Beta",
      searchable: true,
      userId: "bob",
    });
    yield* addUser({
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
      emailVerified: false,
      name: "Unverified",
      searchable: true,
      userId: "unverified",
    });
    yield* addUser({
      createdAt: new Date("2026-01-05T00:00:00.000Z"),
      name: "Hidden",
      searchable: false,
      userId: "hidden",
    });
    yield* addUser({
      createdAt: new Date("2026-01-06T00:00:00.000Z"),
      name: "Private",
      searchable: true,
      userId: "private",
      visibility: PROFILE_VISIBILITY.self,
    });
    yield* addUser({
      createdAt: new Date("2026-01-07T00:00:00.000Z"),
      name: "Operator",
      role: ROLE.administrator,
      searchable: true,
      userId: "operator",
    });
    const all = yield* listMembers({ limit: pageSize, offset: 0 });
    assert.strictEqual(all.total, 2);
    assert.deepStrictEqual(
      all.members.map((member) => member.id),
      ["bob", "alice"],
    );
    const matched = yield* listMembers({ keyword: "alice", limit: pageSize, offset: 0 });
    assert.strictEqual(matched.total, 1);
    assert.strictEqual(matched.members[0]?.id, "alice");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("does not list members who opted out of search even when paid", () =>
  Effect.gen(function* program() {
    yield* addUser({ searchable: true, userId: "listed" });
    yield* addUser({ searchable: false, userId: "not-listed" });
    yield* addPaid("listed");
    yield* addPaid("not-listed");
    const list = yield* listMembers({ limit: pageSize, offset: 0 });
    assert.deepStrictEqual(
      list.members.map((member) => member.id),
      ["listed"],
    );
  }).pipe(Effect.provide(TestDatabase)),
);
