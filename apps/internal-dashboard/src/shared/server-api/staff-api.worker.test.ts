import { assert, describe, it } from "@effect/vitest";
import { signedSessionCookie } from "@repo/auth/testing";
import { APPLICATION, ROLE, STAFF_PERMISSION } from "@repo/config";
import { AUDIT_CHANNEL, Database } from "@repo/db";
import { TestDatabase, addSession, addUser, auditActionsOf } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer, Schema } from "effect";

import { StaffList } from "#shared/contracts/index.ts";
import { routes } from "#shared/telemetry/index.ts";
import { wikiLayer, wikiService } from "#shared/wiki/index.ts";
import { staffApi } from "./staff-api.ts";

type Actor = "admin" | "editor" | "viewer" | "weak-editor";

type Call = Readonly<{
  body?: Readonly<Record<string, unknown>>;
  method: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
}>;

const reporting = { log: recordingSink().sink, service: wikiService } as const;
const invitee = "colleague@example.com";
const inviteePassword = "invited-password-safe-123";

const tokenOf = (actor: Actor): string => `${actor}-session-token`;

const seedAccounts = Effect.gen(function* seedAccounts() {
  yield* addUser({ permission: STAFF_PERMISSION.editor, role: ROLE.staff, userId: "editor" });
  yield* addUser({ permission: STAFF_PERMISSION.viewer, role: ROLE.staff, userId: "viewer" });
  yield* addUser({ permission: STAFF_PERMISSION.editor, role: ROLE.staff, userId: "target" });
  yield* addUser({ role: ROLE.administrator, userId: "admin" });
  for (const actor of ["editor", "viewer", "admin"] as const) {
    yield* addSession({ audience: APPLICATION.wiki, token: tokenOf(actor), userId: actor });
  }
  yield* addSession({
    audience: APPLICATION.wiki,
    strong: false,
    token: tokenOf("weak-editor"),
    userId: "editor",
  });
}).pipe(Effect.provide(TestDatabase));

function wikiApp() {
  const runtime = workerRuntime(() => Layer.orDie(wikiLayer(appEnvironment(), routes)));
  const app = createApi(apiRoot).use(staffApi(apiRoutes(runtime, reporting)));
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

const removal: Call = { body: { id: "target" }, method: "DELETE", path: "/staff" };

const operations: Readonly<Record<string, Call>> = {
  "invite a member": {
    body: { email: invitee, permission: STAFF_PERMISSION.viewer },
    method: "POST",
    path: "/staff/invites",
  },
  "list members": { method: "GET", path: "/staff" },
  "lower a member": {
    body: { id: "target", permission: STAFF_PERMISSION.viewer },
    method: "PATCH",
    path: "/staff",
  },
  "remove a member": removal,
};

const permitted: Readonly<Record<Actor, readonly string[]>> = {
  admin: [],
  editor: Object.keys(operations),
  viewer: [],
  "weak-editor": [],
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

describe("staff API authorization", () => {
  it.effect.each(matrix)("answers $expected when $actor tries to $operation", (attempt) =>
    Effect.gen(function* program() {
      yield* seedAccounts;
      const app = wikiApp();
      const response = yield* app.as(attempt.actor, requireOperation(attempt.operation));
      assert.strictEqual(response.status, attempt.expected);
      yield* app.stop;
    }),
  );

  it.effect("asks anonymous callers to log in", () =>
    Effect.gen(function* program() {
      yield* seedAccounts;
      const app = wikiApp();
      const response = yield* app.send(requireOperation("list members"));
      assert.strictEqual(response.status, httpStatus.unauthorized);
      yield* app.stop;
    }),
  );

  it.effect("records who removed a member and keeps a viewer's attempt out of the audit", () =>
    Effect.gen(function* program() {
      yield* seedAccounts;
      const app = wikiApp();
      yield* app.as("viewer", removal);
      yield* app.as("editor", removal);
      const audit = yield* Effect.provide(auditActionsOf("target"), Database.layer(env.DB));
      assert.deepStrictEqual(audit, [
        {
          action: "staff_removed",
          actorId: "editor",
          actorKind: ROLE.staff,
          channel: AUDIT_CHANNEL.ui,
        },
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

describe("staff invitation through the API", () => {
  it.effect("creates the account once from the mailed link and burns the token", () =>
    Effect.gen(function* program() {
      yield* seedAccounts;
      yield* Effect.promise(async () => env.EMAIL.taken());
      const app = wikiApp();
      const invited = yield* app.as("editor", {
        body: { email: invitee, permission: STAFF_PERMISSION.editor },
        method: "POST",
        path: "/staff/invites",
      });
      assert.strictEqual(invited.status, httpStatus.ok);
      const [mail] = yield* Effect.promise(async () => env.EMAIL.taken());
      assert.isDefined(mail);
      assert.strictEqual(mail.to, invitee);
      const token = inviteTokenOf(mail.text);
      const preview: Call = { method: "GET", path: `/invite?token=${encodeURIComponent(token)}` };
      const acceptance: Call = {
        body: { name: "同僚", password: inviteePassword, token },
        method: "POST",
        path: "/invite",
      };
      assert.strictEqual((yield* app.send(preview)).status, httpStatus.ok);
      assert.strictEqual((yield* app.send(acceptance)).status, httpStatus.ok);
      assert.strictEqual((yield* app.send(acceptance)).status, httpStatus.notFound);
      assert.strictEqual((yield* app.send(preview)).status, httpStatus.notFound);
      const staff = yield* Schema.decodeUnknownEffect(StaffList)(
        yield* readJson(yield* app.as("editor", requireOperation("list members"))),
      );
      assert.strictEqual(
        staff.find((member) => member.email === invitee)?.permission,
        STAFF_PERMISSION.editor,
      );
      yield* app.stop;
    }),
  );
});
