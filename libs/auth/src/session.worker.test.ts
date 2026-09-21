import {
  ACCOUNT_STATE,
  ADMIN_PERMISSION,
  APPLICATION,
  AUTHENTICATION_METHOD,
  ROLE,
} from "@repo/config";
import { getSessionSecurity } from "@repo/db";
import { setMemberState } from "@repo/db/admin";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { AdminMfaRequired } from "./admin-mfa-required.ts";
import { SessionInvalid } from "./session-invalid.ts";
import { SessionRequired } from "./session-required.ts";
import {
  AuthApps,
  assignRoleByEmail,
  authTest,
  bootstrapVerifiedAdmin,
  clientOf,
  enableTotp,
  pendingSecondFactor,
  registerVerified,
  requireStatus,
  runWith,
  signIn,
  signInAgainAfterTotp,
  signInAs,
  wikiStaff,
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
          permission: ADMIN_PERMISSION.owner,
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
          permission: ADMIN_PERMISSION.owner,
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
          permission: null,
          role: ROLE.member,
          twoFactorEnabled: true,
        },
      });
    });
  });

  describe("an administrator signed in with a recovery code", () => {
    const it = authTest().extend("recovery", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* recover() {
          yield* bootstrapVerifiedAdmin("admin@example.com");
          const { backupCodes } = yield* enableTotp(
            yield* signInAs(APPLICATION.admin, "admin@example.com"),
          );
          const client = yield* pendingSecondFactor(APPLICATION.admin, "admin@example.com");
          yield* requireStatus(200, {
            client,
            endpoint: "/two-factor/verify-backup-code",
            jsonFields: { code: backupCodes[0] },
          });
          const verified = yield* client.verify(true);
          const security = yield* getSessionSecurity(verified.session.id, APPLICATION.admin);
          return {
            authenticationMethod: security?.session.authenticationMethod,
            verified,
          };
        }),
      ),
    );

    it("is a weak session that stays on the recovery code", ({ recovery }) => {
      expect(recovery).toStrictEqual({
        authenticationMethod: AUTHENTICATION_METHOD.recovery,
        verified: {
          session: { id: "session-4" },
          strong: false,
          user: {
            email: "admin@example.com",
            id: "user-1",
            name: "admin@example.com",
            permission: ADMIN_PERMISSION.owner,
            role: ROLE.administrator,
            twoFactorEnabled: true,
          },
        },
      });
    });
  });

  describe("an administrator signing in to the user app", () => {
    const it = authTest().extend("status", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* crossOver() {
          yield* bootstrapVerifiedAdmin("admin@example.com");
          return yield* signIn(yield* clientOf(APPLICATION.user), "admin@example.com");
        }),
      ),
    );

    it("is refused because administrators are not members", ({ status }) => {
      expect(status).toBe(403);
    });
  });

  describe("user app cookies replayed against the admin app", () => {
    const it = authTest().extend("replayed", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* replay() {
          yield* registerVerified("member@example.com");
          const client = yield* signInAs(APPLICATION.user, "member@example.com");
          const admin = (yield* AuthApps)[APPLICATION.admin];
          return yield* Effect.flip(client.transferTo(admin).verify(true));
        }),
      ),
    );

    it("is not a session of the admin app", ({ replayed }) => {
      expect(replayed).toStrictEqual(new SessionInvalid());
    });
  });

  describe("a member suspended by an operator", () => {
    const it = authTest().extend("suspension", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* suspend() {
          yield* bootstrapVerifiedAdmin("owner@example.com");
          const owner = yield* signInAs(APPLICATION.admin, "owner@example.com");
          yield* enableTotp(owner);
          const authority = yield* owner.verify();
          yield* registerVerified("target@example.com");
          const memberClient = yield* signInAs(APPLICATION.user, "target@example.com");
          const member = yield* memberClient.verify();
          yield* setMemberState({
            accountState: ACCOUNT_STATE.suspended,
            memberId: member.user.id,
            sessionId: authority.session.id,
          });
          return {
            lostSession: yield* Effect.flip(memberClient.verify()),
            signInStatus: yield* signIn(yield* clientOf(APPLICATION.user), "target@example.com"),
          };
        }),
      ),
    );

    it("loses the session it held", ({ suspension }) => {
      expect(suspension.lostSession).toStrictEqual(new SessionRequired());
    });

    it("cannot sign in again", ({ suspension }) => {
      expect(suspension.signInStatus).toBe(403);
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
          const verified = yield* client.verify();
          const security = yield* getSessionSecurity(verified.session.id, APPLICATION.user);
          return {
            audience: security?.session.audience,
            authenticationMethod: security?.session.authenticationMethod,
            verified,
          };
        }),
      ),
    );

    it("keeps the member role, the user audience and the password method", ({ selfAssigned }) => {
      expect(selfAssigned).toStrictEqual({
        audience: APPLICATION.user,
        authenticationMethod: AUTHENTICATION_METHOD.password,
        verified: {
          session: { id: "session-1" },
          strong: false,
          user: {
            email: "reader@example.com",
            id: "user-1",
            name: "reader@example.com",
            permission: null,
            role: ROLE.member,
            twoFactorEnabled: false,
          },
        },
      });
    });
  });

  describe("a staff member demoted to member", () => {
    const it = authTest().extend("demoted", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* demote() {
          const wiki = yield* wikiStaff("owner@example.com");
          yield* registerVerified("second@example.com");
          yield* assignRoleByEmail("second@example.com", ROLE.staff);
          yield* assignRoleByEmail("owner@example.com", ROLE.member);
          return yield* Effect.flip(wiki.verify());
        }),
      ),
    );

    it("loses the wiki session", ({ demoted }) => {
      expect(demoted).toStrictEqual(new SessionRequired());
    });
  });
});
