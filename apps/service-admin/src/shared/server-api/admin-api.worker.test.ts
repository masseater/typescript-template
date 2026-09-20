import { assert, describe, it } from "@effect/vitest";
import { signedSessionCookie } from "@repo/auth/testing";
import { ACCOUNT_STATE, ADMIN_PERMISSION, APPLICATION, ROLE } from "@repo/config";
import { Database } from "@repo/db";
import { TestDatabase, addSession, addUser, auditActionsOf } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer, Schema } from "effect";

import { AdminList } from "#shared/contracts/index.ts";
import { routes } from "#shared/telemetry/index.ts";
import { adminRoutes } from "./admin-api.ts";

import type { AdminPermission } from "@repo/config";

type Actor = "member" | "operator" | "owner" | "viewer" | "weak-owner";

type Call = Readonly<{
  body?: Readonly<Record<string, unknown>>;
  method: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
}>;

const reporting = { log: recordingSink().sink, service: APPLICATION.admin } as const;
const invitee = "newcomer@example.com";
const inviteePassword = "invited-password-safe-123";

const adminLevels: Readonly<Record<Exclude<Actor, "member" | "weak-owner">, AdminPermission>> = {
  operator: ADMIN_PERMISSION.operator,
  owner: ADMIN_PERMISSION.owner,
  viewer: ADMIN_PERMISSION.viewer,
};

const tokenOf = (actor: Actor): string => `${actor}-session-token`;

const seedAccounts = Effect.gen(function* seedAccounts() {
  for (const [actor, permission] of Object.entries(adminLevels)) {
    yield* addUser({ permission, role: ROLE.administrator, userId: actor });
    yield* addSession({ audience: APPLICATION.admin, token: tokenOf(actor), userId: actor });
  }
  yield* addSession({
    audience: APPLICATION.admin,
    strong: false,
    token: tokenOf("weak-owner"),
    userId: "owner",
  });
  yield* addUser({ userId: "member" });
  yield* addSession({ audience: APPLICATION.admin, token: tokenOf("member"), userId: "member" });
  yield* addUser({ userId: "target" });
}).pipe(Effect.provide(TestDatabase));

function adminApp() {
  const runtime = workerRuntime(() =>
    Layer.orDie(appLayer(appEnvironment(), APPLICATION.admin, routes)),
  );
  const app = createApi(apiRoot).use(adminRoutes(apiRoutes(runtime, reporting)));
  const cookieOf = (actor: Actor): Effect.Effect<string> =>
    Effect.promise(async () => runtime.runPromise(signedSessionCookie(tokenOf(actor))));
  const send = (call: Call, cookie?: string): Effect.Effect<Response> =>
    Effect.promise(async () =>
      app.fetch(
        new Request(`${fixtureOrigin}${apiRoot}${call.path}`, {
          ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
          headers: {
            "content-type": "application/json",
            origin: fixtureOrigin,
            ...(cookie === undefined ? {} : { cookie }),
          },
          method: call.method,
        }),
      ),
    );
  const as = Effect.fn("as")(function* as(actor: Actor, call: Call) {
    return yield* send(call, yield* cookieOf(actor));
  });
  return { as, send, stop: Effect.promise(async () => runtime.dispose()) };
}

const memberSuspension: Call = {
  body: { accountState: ACCOUNT_STATE.suspended, id: "target" },
  method: "PATCH",
  path: "/users",
};

const operations: Readonly<Record<string, Call>> = {
  "delete a member": { body: { id: "target" }, method: "DELETE", path: "/users" },
  "disable an admin": {
    body: { accountState: ACCOUNT_STATE.suspended, id: "operator" },
    method: "PATCH",
    path: "/admins/state",
  },
  "invite an admin": {
    body: { email: invitee, permission: ADMIN_PERMISSION.viewer },
    method: "POST",
    path: "/admins/invites",
  },
  "list admins": { method: "GET", path: "/admins" },
  "list members": { method: "GET", path: "/users" },
  "lower an admin": {
    body: { id: "operator", permission: ADMIN_PERMISSION.viewer },
    method: "PATCH",
    path: "/admins",
  },
  "suspend a member": memberSuspension,
};

const permitted: Readonly<Record<Actor, readonly string[]>> = {
  member: [],
  operator: ["list members", "suspend a member", "delete a member"],
  owner: Object.keys(operations),
  viewer: ["list members"],
  "weak-owner": [],
};

const matrix = Object.entries(permitted).flatMap(([actor, allowed]) =>
  Object.keys(operations).map((operation) => ({
    actor: actor as Actor,
    expected: allowed.includes(operation) ? httpStatus.ok : httpStatus.forbidden,
    operation,
  })),
);

const requireOperation = (operation: string): Call => {
  const call = operations[operation];
  assert.isDefined(call);
  return call;
};

describe("admin API authorization", () => {
  it.effect.each(matrix)("answers $expected when $actor tries to $operation", (attempt) =>
    Effect.gen(function* program() {
      yield* seedAccounts;
      const app = adminApp();
      const response = yield* app.as(attempt.actor, requireOperation(attempt.operation));
      assert.strictEqual(response.status, attempt.expected);
      yield* app.stop;
    }),
  );

  it.effect("asks anonymous callers to log in", () =>
    Effect.gen(function* program() {
      yield* seedAccounts;
      const app = adminApp();
      const response = yield* app.send(requireOperation("list members"));
      assert.strictEqual(response.status, httpStatus.unauthorized);
      yield* app.stop;
    }),
  );

  it.effect("records who suspended a member and keeps a forbidden attempt out of the audit", () =>
    Effect.gen(function* program() {
      yield* seedAccounts;
      const app = adminApp();
      yield* app.as("viewer", memberSuspension);
      yield* app.as("operator", memberSuspension);
      const audit = yield* Effect.provide(auditActionsOf("target"), Database.layer(env.DB));
      assert.deepStrictEqual(audit, [
        { action: "member_suspended", actorId: "operator", actorKind: ROLE.administrator },
      ]);
      yield* app.stop;
    }),
  );
});

const inviteTokenOf = (text: string): string => {
  const link = text.split("\n").find((line) => line.startsWith(fixtureOrigin));
  return decodeURIComponent(new URL(link ?? "").pathname.split("/").at(-1) ?? "");
};

const readJson = (response: Response): Effect.Effect<unknown> =>
  Effect.promise(async (): Promise<unknown> => response.json());

describe("admin invitation through the API", () => {
  it.effect("creates the account once from the mailed link and burns the token", () =>
    Effect.gen(function* program() {
      yield* seedAccounts;
      yield* Effect.promise(async () => env.EMAIL.taken());
      const app = adminApp();
      const invited = yield* app.as("owner", {
        body: { email: invitee, permission: ADMIN_PERMISSION.operator },
        method: "POST",
        path: "/admins/invites",
      });
      assert.strictEqual(invited.status, httpStatus.ok);
      const [mail] = yield* Effect.promise(async () => env.EMAIL.taken());
      assert.isDefined(mail);
      assert.strictEqual(mail.to, invitee);
      const token = inviteTokenOf(mail.text);
      const preview: Call = { method: "GET", path: `/invite?token=${encodeURIComponent(token)}` };
      const acceptance: Call = {
        body: { name: "新任者", password: inviteePassword, token },
        method: "POST",
        path: "/invite",
      };
      assert.strictEqual((yield* app.send(preview)).status, httpStatus.ok);
      assert.strictEqual((yield* app.send(acceptance)).status, httpStatus.ok);
      assert.strictEqual((yield* app.send(acceptance)).status, httpStatus.notFound);
      assert.strictEqual((yield* app.send(preview)).status, httpStatus.notFound);
      const admins = yield* Schema.decodeUnknownEffect(AdminList)(
        yield* readJson(yield* app.as("owner", requireOperation("list admins"))),
      );
      const newcomer = admins.find((admin) => admin.email === invitee);
      assert.deepStrictEqual(
        { accountState: newcomer?.accountState, permission: newcomer?.permission },
        { accountState: ACCOUNT_STATE.active, permission: ADMIN_PERMISSION.operator },
      );
      yield* app.stop;
    }),
  );
});
