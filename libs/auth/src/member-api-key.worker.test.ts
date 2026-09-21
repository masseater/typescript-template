import { assert, it } from "@effect/vitest";
import { APPLICATION, ROLE, memberApiKeyReadPermissions } from "@repo/config";
import { query, schema } from "@repo/db";
import { Effect } from "effect";

import { AuthApps, registerVerified, signInAs, withAuth } from "./testing.ts";

const { apikey, user } = schema;

const addListedMember = (memberId: string, emailVerified = true) =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      email: `${memberId}@example.com`,
      emailVerified,
      id: memberId,
      name: memberId,
      role: ROLE.member,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

const ownerOf = (email: string) =>
  Effect.gen(function* findOwner() {
    const owner = (yield* query((database) =>
      database.select({ email: user.email, id: user.id }).from(user),
    )).find((row) => row.email === email);
    if (owner === undefined) {
      return yield* Effect.die("owner missing");
    }
    return owner.id;
  });

it.effect("stores a hash and returns plaintext once", () =>
  withAuth(
    Effect.gen(function* issueKey() {
      yield* addListedMember("listed");
      yield* registerVerified("owner@example.com");
      yield* signInAs(APPLICATION.user, "owner@example.com");
      const ownerId = yield* ownerOf("owner@example.com");
      const authService = (yield* AuthApps)[APPLICATION.user];
      const created = yield* Effect.promise(async () =>
        (
          authService.instance.api as {
            createApiKey: (input: unknown) => Promise<{ id: string; key: string }>;
          }
        ).createApiKey({
          body: { name: "integration", userId: ownerId },
        }),
      );
      const stored = (yield* query((database) => database.select().from(apikey))).find(
        (row) => row.id === created.id,
      );
      assert.isDefined(created.key);
      assert.notStrictEqual(created.key, stored?.key);
      assert.strictEqual(stored?.referenceId, ownerId);
    }),
  ),
);

it.effect("rejects revoked keys on verification", () =>
  withAuth(
    Effect.gen(function* revokeKey() {
      yield* registerVerified("reader@example.com");
      yield* signInAs(APPLICATION.user, "reader@example.com");
      const ownerId = yield* ownerOf("reader@example.com");
      const authService = (yield* AuthApps)[APPLICATION.user];
      const api = authService.instance.api as {
        createApiKey: (input: unknown) => Promise<{ id: string; key: string }>;
        updateApiKey: (input: unknown) => Promise<{ id: string }>;
        verifyApiKey: (input: unknown) => Promise<{ valid: boolean }>;
      };
      const created = yield* Effect.promise(async () =>
        api.createApiKey({
          body: { name: "read-only", userId: ownerId },
        }),
      );
      const verified = yield* Effect.promise(async () =>
        api.verifyApiKey({
          body: { key: created.key, permissions: memberApiKeyReadPermissions },
        }),
      );
      yield* Effect.promise(async () =>
        api.updateApiKey({
          body: { enabled: false, keyId: created.id, userId: ownerId },
        }),
      );
      const revoked = yield* Effect.promise(async () =>
        api.verifyApiKey({
          body: { key: created.key, permissions: memberApiKeyReadPermissions },
        }),
      );
      assert.strictEqual(verified.valid, true);
      assert.strictEqual(revoked.valid, false);
    }),
  ),
);
