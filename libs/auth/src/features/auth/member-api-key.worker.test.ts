import { APPLICATION, ROLE, memberApiKeyReadPermissions } from "@repo/config";
import { query, schema } from "@repo/db";
import { DateTime, Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { AuthApps, authTest, registerVerified, runWith, signInAs } from "./testing.ts";

const { apikey, user } = schema;

const listedAt = DateTime.toDate(DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"));

describe("an api key issued to a member", () => {
  const it = authTest.extend("issuedKey", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* issueKey() {
        yield* query((database) =>
          database.insert(user).values({
            createdAt: listedAt,
            email: "listed@example.com",
            emailVerified: true,
            id: "listed",
            name: "listed",
            role: ROLE.member,
            updatedAt: listedAt,
          }),
        );
        yield* registerVerified("owner@example.com");
        yield* signInAs(APPLICATION.user, "owner@example.com");
        const accounts = yield* query((database) =>
          database.select({ email: user.email, id: user.id }).from(user),
        );
        const owner = accounts.find((account) => account.email === "owner@example.com");
        if (owner === undefined) {
          return yield* Effect.die("owner missing");
        }
        const { api } = (yield* AuthApps)[APPLICATION.user].instance;
        const createApiKey = yield* Effect.fromNullishOr(api.createApiKey).pipe(Effect.orDie);
        const issued = yield* Effect.promise(() =>
          createApiKey({ body: { name: "integration", userId: owner.id } }),
        );
        const storedKeys = yield* query((database) => database.select().from(apikey));
        const stored = storedKeys.find((storedKey) => storedKey.id === issued.id);
        return {
          hashedAtRest: stored?.key !== issued.key,
          ownedByMember: stored?.referenceId === owner.id,
          plaintextReturned: issued.key.length > 0,
        };
      }),
    ),
  );

  it("stores a hash and returns plaintext once", ({ issuedKey }) => {
    expect(issuedKey).toStrictEqual({
      hashedAtRest: true,
      ownedByMember: true,
      plaintextReturned: true,
    });
  });
});

describe("an api key revoked by its member", () => {
  const it = authTest.extend("keyValidity", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* revokeKey() {
        yield* registerVerified("reader@example.com");
        yield* signInAs(APPLICATION.user, "reader@example.com");
        const accounts = yield* query((database) =>
          database.select({ email: user.email, id: user.id }).from(user),
        );
        const reader = accounts.find((account) => account.email === "reader@example.com");
        if (reader === undefined) {
          return yield* Effect.die("reader missing");
        }
        const { api } = (yield* AuthApps)[APPLICATION.user].instance;
        const createApiKey = yield* Effect.fromNullishOr(api.createApiKey).pipe(Effect.orDie);
        const updateApiKey = yield* Effect.fromNullishOr(api.updateApiKey).pipe(Effect.orDie);
        const verifyApiKey = yield* Effect.fromNullishOr(api.verifyApiKey).pipe(Effect.orDie);
        const issued = yield* Effect.promise(() =>
          createApiKey({ body: { name: "read-only", userId: reader.id } }),
        );
        const beforeRevocation = yield* Effect.promise(() =>
          verifyApiKey({ body: { key: issued.key, permissions: memberApiKeyReadPermissions } }),
        );
        yield* Effect.promise(() =>
          updateApiKey({ body: { enabled: false, keyId: issued.id, userId: reader.id } }),
        );
        const afterRevocation = yield* Effect.promise(() =>
          verifyApiKey({ body: { key: issued.key, permissions: memberApiKeyReadPermissions } }),
        );
        return { afterRevocation: afterRevocation.valid, beforeRevocation: beforeRevocation.valid };
      }),
    ),
  );

  it("verifies until it is revoked", ({ keyValidity }) => {
    expect(keyValidity).toStrictEqual({ afterRevocation: false, beforeRevocation: true });
  });
});
