import { APPLICATION, ROLE } from "@repo/config";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  PASSWORD,
  audienceInputs,
  authTest,
  clearMailbox,
  clientOf,
  hasMail,
  mailRecipients,
  mailSubjects,
  missingSchemaFields,
  origins,
  receivedLink,
  register,
  registerVerified,
  runWith,
  signIn,
  spendSignInWindow,
  verifyEmail,
} from "./testing.ts";

describe("createAuth", () => {
  describe("a registered user whose email is not verified yet", () => {
    const it = authTest()
      .extend("unverified", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInUnverified() {
            return yield* signIn(yield* register("alice@example.com"), "alice@example.com");
          }),
        ),
      )
      .extend("verified", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInVerified() {
            const client = yield* register("alice@example.com");
            yield* verifyEmail("alice@example.com");
            return yield* signIn(client, "alice@example.com");
          }),
        ),
      );

    it("cannot sign in with the password", ({ unverified }) => {
      expect(unverified).toBe(403);
    });

    it("signs in once the email is verified", ({ verified }) => {
      expect(verified).toBe(200);
    });
  });

  describe("the admin app", () => {
    const it = authTest().extend("signUp", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* signUpToAdmin() {
          const client = yield* clientOf(APPLICATION.admin);
          return yield* client.status("/sign-up/email", {
            email: "admin@example.com",
            name: "admin",
            password: PASSWORD,
          });
        }),
      ),
    );

    it("refuses public registration", ({ signUp }) => {
      expect(signUp).toBe(400);
    });
  });

  describe("the user app", () => {
    const it = authTest()
      .extend("userList", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* listUsers() {
            return yield* (yield* clientOf(APPLICATION.user)).status("/admin/list-users");
          }),
        ),
      )
      .extend("roleChange", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* setRole() {
            return yield* (yield* clientOf(APPLICATION.user)).status("/admin/set-role", {
              role: ROLE.administrator,
              userId: "x",
            });
          }),
        ),
      );

    it("has no user listing endpoint", ({ userList }) => {
      expect(userList).toBe(404);
    });

    it("has no role change endpoint", ({ roleChange }) => {
      expect(roleChange).toBe(404);
    });
  });

  describe("an unverified user signing in", () => {
    const it = authTest()
      .extend("wikiRecipients", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInToWiki() {
            yield* register("pending@example.com");
            yield* signIn(yield* clientOf(APPLICATION.wiki), "pending@example.com");
            return yield* mailRecipients;
          }),
        ),
      )
      .extend("userRecipients", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInToUser() {
            yield* register("pending@example.com");
            yield* signIn(yield* clientOf(APPLICATION.user), "pending@example.com");
            return yield* mailRecipients;
          }),
        ),
      );

    it("gets no verification email from the wiki", ({ wikiRecipients }) => {
      expect(wikiRecipients).toStrictEqual(["pending@example.com"]);
    });

    it("gets another verification email from the user app", ({ userRecipients }) => {
      expect(userRecipients).toStrictEqual(["pending@example.com", "pending@example.com"]);
    });
  });

  describe.for([APPLICATION.user, APPLICATION.wiki] as const)("the %s app", (audience) => {
    const it = authTest()
      .extend("missingFields", async ({ auth }) =>
        runWith(auth, () => missingSchemaFields(audience)),
      )
      .extend("inputs", async ({ auth }) => runWith(auth, () => audienceInputs(audience)));

    it("finds every field its plugins need in the database", ({ missingFields }) => {
      expect(missingFields).toStrictEqual([]);
    });

    it("never takes the passkey or verification audience as input", ({ inputs }) => {
      expect(inputs).toStrictEqual([false, false]);
    });
  });

  describe("sign-in attempts from one address", () => {
    const spender = { "cf-connecting-ip": "203.0.113.10" };
    const it = authTest()
      .extend("burst", async ({ auth }) =>
        runWith(auth, () => spendSignInWindow({ email: "spender@example.com", network: spender })),
      )
      .extend("bystander", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInBeside() {
            yield* spendSignInWindow({ email: "spender@example.com", network: spender });
            const bystander = yield* clientOf(APPLICATION.user, {
              "cf-connecting-ip": "203.0.113.11",
            });
            return yield* signIn(bystander, "spender@example.com");
          }),
        ),
      )
      .extend("forwarded", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* forward() {
            yield* spendSignInWindow({ email: "spender@example.com", network: spender });
            const forwarder = yield* clientOf(APPLICATION.user, {
              ...spender,
              "x-forwarded-for": "203.0.113.21",
            });
            return yield* signIn(forwarder, "spender@example.com");
          }),
        ),
      );

    it("exhaust the window of that address", ({ burst }) => {
      expect(burst).toStrictEqual([200, 200, 200, 429]);
    });

    it("leave another address its own window", ({ bystander }) => {
      expect(bystander).toBe(200);
    });

    it("are not reopened by a forwarded-for header", ({ forwarded }) => {
      expect(forwarded).toBe(429);
    });
  });

  describe("a member on the wiki", () => {
    const it = authTest()
      .extend("signInStatus", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInMember() {
            yield* registerVerified("member@example.com");
            return yield* signIn(yield* clientOf(APPLICATION.wiki), "member@example.com");
          }),
        ),
      )
      .extend("signUpStatus", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signUpMember() {
            return yield* (yield* clientOf(APPLICATION.wiki)).status("/sign-up/email", {
              email: "new@example.com",
              name: "new",
              password: PASSWORD,
            });
          }),
        ),
      );

    it("cannot sign in", ({ signInStatus }) => {
      expect(signInStatus).toBe(403);
    });

    it("cannot sign up", ({ signUpStatus }) => {
      expect(signUpStatus).toBe(400);
    });
  });

  describe("someone signing up with a registered address", () => {
    const it = authTest()
      .extend("verifiedNotice", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* noticeVerifiedOwner() {
            const client = yield* registerVerified("taken@example.com");
            yield* clearMailbox;
            yield* register("taken@example.com");
            const notice = yield* receivedLink("taken@example.com", mailSubjects.existingAccount);
            yield* clearMailbox;
            yield* register("taken@example.com");
            return {
              keptSession: yield* signIn(client, "taken@example.com"),
              noticeHref: notice.href,
              throttled: !(yield* hasMail("taken@example.com")),
            };
          }),
        ),
      )
      .extend("unverifiedNotice", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* noticeUnverifiedOwner() {
            const client = yield* register("unverified@example.com");
            yield* clearMailbox;
            yield* register("unverified@example.com");
            yield* verifyEmail("unverified@example.com");
            return yield* signIn(client, "unverified@example.com");
          }),
        ),
      );

    it("mails a login link once per notice window when the account is verified", ({
      verifiedNotice,
    }) => {
      expect(verifiedNotice).toStrictEqual({
        keptSession: 200,
        noticeHref: new URL("/login", origins[APPLICATION.user]).href,
        throttled: true,
      });
    });

    it("mails a fresh verification link when the account is still unverified", ({
      unverifiedNotice,
    }) => {
      expect(unverifiedNotice).toBe(200);
    });
  });
});
