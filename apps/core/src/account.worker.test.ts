import {
  PASSWORD,
  authTest,
  authTestSecret,
  bootstrapVerifiedAdmin,
  enableTotp,
  runWith,
  signInAs,
} from "@repo/auth/testing";
import { ADMIN_PERMISSION, APPLICATION } from "@repo/config";
import { AdminRpcs, createRpcFetcher, makeCoreClient, withForwardedCookies } from "@repo/core-api";
import { inviteAdmin } from "@repo/db/admin";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { adminHandlers } from "./handlers.ts";

import type { CoreBindings } from "./bindings.ts";

const coreBindings = (): CoreBindings => ({
  AUTH_SECRET: authTestSecret,
  DB: env.DB,
  EMAIL: {
    send: (): Promise<{ success: true }> => Promise.resolve({ success: true }),
  } as unknown as SendEmail,
  EMAIL_FROM: "sender@example.test",
});

const adminCore = (): Fetcher => {
  const rpcFetch = createRpcFetcher(AdminRpcs, adminHandlers(coreBindings())).fetch;
  return {
    connect: (): never => {
      throw new Error("Core RPC does not open sockets");
    },
    fetch: (input, init) => rpcFetch(new Request(input, init)),
  };
};

describe("adminHandlers invite RPC", () => {
  const it = authTest().extend("outcome", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* inviteThroughCore() {
        yield* bootstrapVerifiedAdmin("owner@example.com");
        const owner = yield* signInAs(APPLICATION.admin, "owner@example.com");
        yield* enableTotp(owner);
        const authority = yield* owner.verify();
        const invited = yield* inviteAdmin({
          email: "core-invited@example.com",
          permission: ADMIN_PERMISSION.operator,
          sessionId: authority.session.id,
        });
        const client = yield* makeCoreClient(AdminRpcs, adminCore());
        const preview = yield* client.previewInvite({ token: invited.token });
        const accepted = yield* client.acceptInvite({
          name: "Core Invited",
          password: PASSWORD,
          token: invited.token,
        });
        const reused = yield* client
          .acceptInvite({
            name: "Again",
            password: PASSWORD,
            token: invited.token,
          })
          .pipe(Effect.flip);
        const signedIn = yield* signInAs(APPLICATION.admin, "core-invited@example.com");
        const session = yield* client
          .getSession({})
          .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        return {
          accepted,
          preview,
          reused: reused._tag,
          sessionPermission: session.user.permission,
        };
      }).pipe(Effect.scoped),
    ),
  );

  it("previews and accepts an admin invite over core RPC", ({ outcome }) => {
    expect(outcome).toStrictEqual({
      accepted: { accepted: true, email: "core-invited@example.com" },
      preview: { email: "core-invited@example.com", permission: ADMIN_PERMISSION.operator },
      reused: "InviteRejected",
      sessionPermission: ADMIN_PERMISSION.operator,
    });
  });
});
