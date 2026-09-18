import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { listUsers } from "./admin.ts";
import { query } from "./database.ts";
import { addSession } from "./records-fixture.ts";
import { user } from "./schema.ts";
import { TestDatabase } from "./testing.ts";

const members = [
  {
    createdAt: "2026-09-01",
    email: "actor@example.com",
    id: "actor",
    name: "管理者",
    role: "admin",
  },
  { createdAt: "2026-09-02", email: "alice@example.com", id: "alice", name: "Alice", role: "user" },
  {
    createdAt: "2026-09-03",
    email: "bob@example.net",
    emailVerified: false,
    id: "bob",
    name: "Bob",
    role: "user",
  },
  { createdAt: "2026-09-04", email: "sale@example.com", id: "sale", name: "50%_off", role: "user" },
  {
    createdAt: "2026-09-05",
    email: "carol@example.org",
    id: "carol",
    name: "山田 花子",
    role: "admin",
  },
  {
    createdAt: "2026-09-06",
    email: "dave@example.com",
    id: "dave",
    name: "Dave",
    role: "user",
    totp: true,
  },
] as const;

const seedMembers = Effect.fn("seedMembers")(function* seedMembers() {
  for (const member of members) {
    const createdAt = new Date(member.createdAt);
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    yield* query(async (database): Promise<void> => {
      await database.insert(user).values({
        createdAt,
        email: member.email,
        emailVerified: !("emailVerified" in member),
        id: member.id,
        name: member.name,
        role: member.role,
        twoFactorEnabled: "totp" in member,
        updatedAt: createdAt,
      });
    });
  }
  return yield* addSession("actor", "admin");
});

function listed(
  page: Readonly<{ total: number; users: readonly Readonly<{ id: string }>[] }>,
): Readonly<{ ids: readonly string[]; total: number }> {
  return { ids: page.users.map((member) => member.id), total: page.total };
}

it.effect("lists newest users first with the fields the admin table shows", () =>
  Effect.gen(function* program() {
    const session = yield* seedMembers();
    assert.deepStrictEqual(yield* listUsers(session, { limit: 2, offset: 0 }), {
      total: 6,
      users: [
        {
          createdAt: new Date("2026-09-06"),
          email: "dave@example.com",
          emailVerified: true,
          id: "dave",
          name: "Dave",
          role: "user",
          twoFactorEnabled: true,
        },
        {
          createdAt: new Date("2026-09-05"),
          email: "carol@example.org",
          emailVerified: true,
          id: "carol",
          name: "山田 花子",
          role: "admin",
          twoFactorEnabled: false,
        },
      ],
    });
    assert.deepStrictEqual(listed(yield* listUsers(session, { limit: 2, offset: 4 })), {
      ids: ["alice", "actor"],
      total: 6,
    });
    assert.deepStrictEqual(listed(yield* listUsers(session, { limit: 2, offset: 6 })), {
      ids: [],
      total: 6,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("matches the keyword against name or email, ignoring ASCII case", () =>
  Effect.gen(function* program() {
    const session = yield* seedMembers();
    assert.deepStrictEqual(
      listed(yield* listUsers(session, { keyword: "ALI", limit: 50, offset: 0 })),
      { ids: ["alice"], total: 1 },
    );
    assert.deepStrictEqual(
      listed(yield* listUsers(session, { keyword: "example.net", limit: 50, offset: 0 })),
      { ids: ["bob"], total: 1 },
    );
    assert.deepStrictEqual(
      listed(yield* listUsers(session, { keyword: "花子", limit: 50, offset: 0 })),
      { ids: ["carol"], total: 1 },
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("treats LIKE wildcards in the keyword as literal characters", () =>
  Effect.gen(function* program() {
    const session = yield* seedMembers();
    assert.deepStrictEqual(
      listed(yield* listUsers(session, { keyword: "%", limit: 50, offset: 0 })),
      { ids: ["sale"], total: 1 },
    );
    assert.deepStrictEqual(
      listed(yield* listUsers(session, { keyword: "_", limit: 50, offset: 0 })),
      { ids: ["sale"], total: 1 },
    );
    assert.deepStrictEqual(
      listed(yield* listUsers(session, { keyword: "\\", limit: 50, offset: 0 })),
      { ids: [], total: 0 },
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("filters by role and email verification and counts only the matches", () =>
  Effect.gen(function* program() {
    const session = yield* seedMembers();
    assert.deepStrictEqual(
      listed(yield* listUsers(session, { limit: 50, offset: 0, role: "admin" })),
      { ids: ["carol", "actor"], total: 2 },
    );
    assert.deepStrictEqual(
      listed(yield* listUsers(session, { emailVerified: false, limit: 50, offset: 0 })),
      { ids: ["bob"], total: 1 },
    );
    assert.deepStrictEqual(
      listed(
        yield* listUsers(session, {
          emailVerified: true,
          keyword: "example.com",
          limit: 1,
          offset: 1,
          role: "user",
        }),
      ),
      { ids: ["sale"], total: 3 },
    );
  }).pipe(Effect.provide(TestDatabase)),
);
