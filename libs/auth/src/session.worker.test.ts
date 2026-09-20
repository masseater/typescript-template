import { APPLICATION, ROLE } from "@repo/config";
import { setUserRole } from "@repo/db/admin";
import { runStatement } from "@repo/db/testing";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { AdminMfaRequired } from "./admin-mfa-required.ts";
import { SessionInvalid } from "./session-invalid.ts";
import { SessionRequired } from "./session-required.ts";
import {
  AuthApps,
  authTest,
  bootstrapVerifiedAdmin,
  enableTotp,
  pendingSecondFactor,
  registerVerified,
  requireStatus,
  runWith,
  signInAgainAfterTotp,
  signInAs,
  wikiAdministrator,
} from "./testing.ts";

describe("verifySession", () => {
  describe("an administrator signed in with a password alone", () => {
    const it = authTest()
      .extend("client", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInPasswordOnly() {
            yield* bootstrapVerifiedAdmin("admin@example.com");
            return yield* signInAs(APPLICATION.admin, "admin@example.com");
          }),
        ),
      )
      .extend("refusal", async ({ auth, client }) =>
        runWith(auth, () => Effect.flip(client.verify())),
      )
      .extend("enrollment", async ({ auth, client }) => runWith(auth, () => client.verify(true)));

    it("is refused outside factor enrollment", ({ refusal }) => {
      expect(refusal).toStrictEqual(new AdminMfaRequired());
    });

    it("is a weak session while enrolling a factor", ({ enrollment }) => {
      expect(enrollment).toStrictEqual({
        session: { id: "session-1" },
        strong: false,
        user: {
          email: "admin@example.com",
          id: "user-1",
          name: "admin@example.com",
          role: ROLE.administrator,
          twoFactorEnabled: false,
        },
      });
    });
  });

  describe("an administrator who verified a TOTP code on the same session", () => {
    const it = authTest().extend("verified", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* enrollTotp() {
          yield* bootstrapVerifiedAdmin("admin@example.com");
          const client = yield* signInAs(APPLICATION.admin, "admin@example.com");
          yield* enableTotp(client);
          return yield* client.verify();
        }),
      ),
    );

    it("is a strong session", ({ verified }) => {
      expect(verified).toStrictEqual({
        session: { id: "session-2" },
        strong: true,
        user: {
          email: "admin@example.com",
          id: "user-1",
          name: "admin@example.com",
          role: ROLE.administrator,
          twoFactorEnabled: true,
        },
      });
    });
  });

  describe("a user whose password sign-in awaits the second factor", () => {
    const it = authTest()
      .extend("pending", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* awaitSecondFactor() {
            yield* registerVerified("totp@example.com");
            return yield* signInAgainAfterTotp({
              audience: APPLICATION.user,
              email: "totp@example.com",
            });
          }),
        ),
      )
      .extend("refusal", async ({ auth, pending }) =>
        runWith(auth, () => Effect.flip(pending.client.verify())),
      )
      .extend("wrongCode", async ({ auth, pending }) =>
        runWith(auth, () => pending.client.status("/two-factor/verify-totp", { code: "x" })),
      )
      .extend("verified", async ({ auth, pending }) =>
        runWith(auth, () =>
          Effect.gen(function* verifySecondFactor() {
            yield* requireStatus(200, {
              client: pending.client,
              endpoint: "/two-factor/verify-totp",
              jsonFields: { code: pending.authenticator.generate() },
            });
            return yield* pending.client.verify();
          }),
        ),
      );

    it("has no session before the second factor", ({ refusal }) => {
      expect(refusal).toStrictEqual(new SessionRequired());
    });

    it("rejects a wrong code", ({ wrongCode }) => {
      expect(wrongCode).toBe(401);
    });

    it("becomes a strong session with a valid code", ({ verified }) => {
      expect(verified).toStrictEqual({
        session: { id: "session-4" },
        strong: true,
        user: {
          email: "totp@example.com",
          id: "user-1",
          name: "totp@example.com",
          role: ROLE.member,
          twoFactorEnabled: true,
        },
      });
    });
  });

  describe.for([APPLICATION.user, APPLICATION.admin] as const)(
    "an administrator signed in to %s with a recovery code",
    (audience) => {
      const it = authTest().extend("recovery", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* recover() {
            yield* bootstrapVerifiedAdmin("admin@example.com");
            const { backupCodes } = yield* enableTotp(
              yield* signInAs(APPLICATION.admin, "admin@example.com"),
            );
            const client = yield* pendingSecondFactor(audience, "admin@example.com");
            yield* requireStatus(200, {
              client,
              endpoint: "/two-factor/verify-backup-code",
              jsonFields: { code: backupCodes[0] },
            });
            return yield* client.verify(true);
          }),
        ),
      );

      it("is a weak session", ({ recovery }) => {
        expect(recovery).toStrictEqual({
          session: { id: "session-4" },
          strong: false,
          user: {
            email: "admin@example.com",
            id: "user-1",
            name: "admin@example.com",
            role: ROLE.administrator,
            twoFactorEnabled: true,
          },
        });
      });
    },
  );

  describe("user app cookies replayed against the admin app", () => {
    const it = authTest().extend("replayed", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* replay() {
          yield* bootstrapVerifiedAdmin("admin@example.com");
          const client = yield* signInAs(APPLICATION.user, "admin@example.com");
          const admin = (yield* AuthApps)[APPLICATION.admin];
          return yield* Effect.flip(client.transferTo(admin).verify(true));
        }),
      ),
    );

    it("is not a session of the admin app", ({ replayed }) => {
      expect(replayed).toStrictEqual(new SessionInvalid());
    });
  });

  describe("a user promoted by an administrator", () => {
    const it = authTest().extend("promoted", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* promote() {
          yield* bootstrapVerifiedAdmin("owner@example.com");
          const owner = yield* signInAs(APPLICATION.admin, "owner@example.com");
          yield* enableTotp(owner);
          const authority = yield* owner.verify();
          yield* registerVerified("target@example.com");
          const promotedClient = yield* signInAs(APPLICATION.user, "target@example.com");
          const promotedUser = yield* promotedClient.verify();
          yield* setUserRole({
            role: ROLE.administrator,
            sessionId: authority.session.id,
            targetId: promotedUser.user.id,
          });
          return yield* Effect.flip(promotedClient.verify());
        }),
      ),
    );

    it("loses the session it held", ({ promoted }) => {
      expect(promoted).toStrictEqual(new SessionRequired());
    });
  });

  describe("a user who posts role, audience and strength updates", () => {
    const it = authTest().extend("selfAssigned", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* selfAssign() {
          yield* registerVerified("reader@example.com");
          const client = yield* signInAs(APPLICATION.user, "reader@example.com");
          yield* client.status("/update-user", { role: ROLE.administrator, securityVersion: 99 });
          yield* client.status("/update-session", {
            audience: APPLICATION.admin,
            authenticationMethod: "passkey_uv",
          });
          return yield* client.verify();
        }),
      ),
    );

    it("keeps the member role and the weak user session", ({ selfAssigned }) => {
      expect(selfAssigned).toStrictEqual({
        session: { id: "session-1" },
        strong: false,
        user: {
          email: "reader@example.com",
          id: "user-1",
          name: "reader@example.com",
          role: ROLE.member,
          twoFactorEnabled: false,
        },
      });
    });
  });

  describe("a wiki administrator demoted to member", () => {
    const it = authTest().extend("demoted", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* demote() {
          const wiki = yield* wikiAdministrator("owner@example.com");
          yield* registerVerified("second@example.com");
          yield* runStatement(
            "UPDATE user SET role = 'admin' WHERE email = ?",
            "second@example.com",
          );
          yield* runStatement(
            "UPDATE user SET role = ? WHERE email = ?",
            ROLE.member,
            "owner@example.com",
          );
          return yield* Effect.flip(wiki.verify());
        }),
      ),
    );

    it("loses the wiki session", ({ demoted }) => {
      expect(demoted).toStrictEqual(new SessionRequired());
    });
  });
});
