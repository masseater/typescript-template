import { assert, it } from "@effect/vitest";
import { query, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect } from "effect";

import { listMembers } from "./members.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const { user } = schema;

interface Seed {
  readonly createdAt: string;
  readonly emailVerified?: boolean;
  readonly id: string;
  readonly name: string;
  readonly profile?: string;
}

function addMembers(seeds: readonly Seed[]): Effect.Effect<void, DatabaseFailure, Database> {
  return query(async (database): Promise<void> => {
    await database.insert(user).values(
      seeds.map((seed) => ({
        createdAt: new Date(seed.createdAt),
        email: `${seed.id}@example.com`,
        emailVerified: seed.emailVerified ?? true,
        id: seed.id,
        name: seed.name,
        profile: seed.profile ?? "",
        role: "member" as const,
        updatedAt: new Date(seed.createdAt),
      })),
    );
  });
}

it.effect("lists verified members newest first with only what others may see", () =>
  Effect.gen(function* program() {
    yield* addMembers([
      { createdAt: "2026-07-01T00:00:00.000Z", id: "old", name: "古参", profile: "最初の利用者" },
      { createdAt: "2026-09-01T00:00:00.000Z", id: "new", name: "新人" },
      {
        createdAt: "2026-08-01T00:00:00.000Z",
        emailVerified: false,
        id: "pending",
        name: "未確認",
      },
    ]);
    assert.deepStrictEqual(yield* listMembers({ limit: 24, offset: 0 }), {
      members: [
        { id: "new", joined: "2026-09", name: "新人", profile: "", socialLinks: [] },
        { id: "old", joined: "2026-07", name: "古参", profile: "最初の利用者", socialLinks: [] },
      ],
      total: 2,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("searches by a part of the name and treats wildcards as plain text", () =>
  Effect.gen(function* program() {
    yield* addMembers([
      { createdAt: "2026-09-03T00:00:00.000Z", id: "a", name: "山田 花子" },
      { createdAt: "2026-09-02T00:00:00.000Z", id: "b", name: "山本 太郎", profile: "花子の友人" },
      { createdAt: "2026-09-01T00:00:00.000Z", id: "c", name: "100%_user" },
    ]);
    assert.deepStrictEqual(yield* listMembers({ keyword: "花子", limit: 24, offset: 0 }), {
      members: [{ id: "a", joined: "2026-09", name: "山田 花子", profile: "", socialLinks: [] }],
      total: 1,
    });
    assert.deepStrictEqual(yield* listMembers({ keyword: "USER", limit: 24, offset: 0 }), {
      members: [{ id: "c", joined: "2026-09", name: "100%_user", profile: "", socialLinks: [] }],
      total: 1,
    });
    assert.deepStrictEqual(yield* listMembers({ keyword: "%", limit: 24, offset: 0 }), {
      members: [{ id: "c", joined: "2026-09", name: "100%_user", profile: "", socialLinks: [] }],
      total: 1,
    });
    assert.deepStrictEqual(yield* listMembers({ keyword: "_", limit: 24, offset: 0 }), {
      members: [{ id: "c", joined: "2026-09", name: "100%_user", profile: "", socialLinks: [] }],
      total: 1,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("pages through the matches and reports the total beyond the last page", () =>
  Effect.gen(function* program() {
    yield* addMembers([
      { createdAt: "2026-09-03T00:00:00.000Z", id: "third", name: "member 3" },
      { createdAt: "2026-09-02T00:00:00.000Z", id: "second", name: "member 2" },
      { createdAt: "2026-09-01T00:00:00.000Z", id: "first", name: "member 1" },
    ]);
    assert.deepStrictEqual(yield* listMembers({ limit: 2, offset: 2 }), {
      members: [{ id: "first", joined: "2026-09", name: "member 1", profile: "", socialLinks: [] }],
      total: 3,
    });
    assert.deepStrictEqual(yield* listMembers({ limit: 2, offset: 4 }), { members: [], total: 3 });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("orders members who registered at the same moment by id", () =>
  Effect.gen(function* program() {
    yield* addMembers([
      { createdAt: "2026-09-01T00:00:00.000Z", id: "b", name: "second by id" },
      { createdAt: "2026-09-01T00:00:00.000Z", id: "a", name: "first by id" },
    ]);
    assert.deepStrictEqual(yield* listMembers({ limit: 24, offset: 0 }), {
      members: [
        { id: "a", joined: "2026-09", name: "first by id", profile: "", socialLinks: [] },
        { id: "b", joined: "2026-09", name: "second by id", profile: "", socialLinks: [] },
      ],
      total: 2,
    });
  }).pipe(Effect.provide(TestDatabase)),
);
