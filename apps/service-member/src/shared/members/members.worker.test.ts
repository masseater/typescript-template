import { assert, it } from "@effect/vitest";
import { ROLE } from "@repo/config";
import { query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";

import { listMembers } from "./members.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;
const recordedAt = new Date("2026-01-02T00:00:00.000Z");
const pageSize = 24;

const addUser = (added: {
  readonly createdAt?: Date;
  readonly emailVerified?: boolean;
  readonly name?: string;
  readonly userId: string;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: added.createdAt ?? recordedAt,
      email: `${added.userId}@example.com`,
      emailVerified: added.emailVerified ?? true,
      id: added.userId,
      name: added.name ?? added.userId,
      role: ROLE.member,
      updatedAt: recordedAt,
    });
  });

it.effect("lists verified members newest first and filters by keyword", () =>
  Effect.gen(function* program() {
    yield* addUser({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      name: "Alice Alpha",
      userId: "alice",
    });
    yield* addUser({
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      name: "Bob Beta",
      userId: "bob",
    });
    yield* addUser({
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
      emailVerified: false,
      name: "Unverified",
      userId: "unverified",
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
