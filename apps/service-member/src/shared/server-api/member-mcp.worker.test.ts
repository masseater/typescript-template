import { Auth } from "@repo/auth";
import { AuthApps, authTest, registerVerified, runWith, signInAs } from "@repo/auth/testing";
import { APPLICATION, MEMBER_MCP_SCOPE, SUBSCRIPTION_STATUS } from "@repo/config";
import { query, schema } from "@repo/db";
import { unavailable } from "@repo/runtime/account";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { describe, expect } from "vite-plus/test";

import { routes } from "#shared/telemetry/index.ts";
import { serveMcp } from "./mcp.ts";
import {
  callTool,
  exchangeMemberCode,
  grantMemberAuthorization,
  memberOrigin,
  startMemberAuthorization,
} from "./member-oauth-fixture.ts";

import type { FetchMcp } from "./member-oauth-fixture.ts";

const authSecret = "integration-test-secret-at-least-32-characters-long";
const reporting = { service: APPLICATION.user } as const;
const { planSubscription, user } = schema;

function memberMcpApp(auth: Parameters<typeof runWith>[0]): {
  fetchMcp: FetchMcp;
  stop: Effect.Effect<void>;
} {
  const memberAuth = Context.get(auth, AuthApps)[APPLICATION.user];
  const runtime = workerRuntime(() =>
    Layer.orDie(
      Layer.merge(
        Layer.succeed(Auth, memberAuth),
        appLayer(
          appEnvironment({ APP_ORIGIN: memberOrigin, AUTH_SECRET: authSecret }),
          APPLICATION.user,
          routes,
        ),
      ),
    ),
  );
  const api = apiRoutes(runtime, reporting);
  const app = createApi("").all("/mcp", api.raw(serveMcp, unavailable));
  const fetchMcp = (request: Request): Effect.Effect<Response, never, never> =>
    Effect.promise(async () => app.fetch(request));
  return { fetchMcp, stop: Effect.promise(async () => runtime.dispose()) };
}

const tokenFor = Effect.fn("tokenFor")(function* tokenFor(email: string, scope: string) {
  const flow = yield* startMemberAuthorization();
  yield* registerVerified(email);
  const member = yield* signInAs(APPLICATION.user, email);
  const code = yield* grantMemberAuthorization(member, flow.oauthQuery, scope);
  const tokens = yield* exchangeMemberCode(flow, code);
  const session = yield* member.verify();
  return { accessToken: tokens.access_token, userId: session.user.id };
});

function toolText(body: unknown): string {
  const result = body as { result?: { content?: readonly { text?: string }[]; isError?: boolean } };
  return result.result?.content?.[0]?.text ?? "";
}

describe("member MCP authorization", () => {
  const it = authTest();

  it("rejects tools the member did not permit", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        const app = memberMcpApp(auth);
        const granted = yield* tokenFor("reader@example.com", MEMBER_MCP_SCOPE.profileRead);
        const profile = yield* callTool(app.fetchMcp, granted.accessToken, "get_profile");
        const search = yield* callTool(app.fetchMcp, granted.accessToken, "search_members");
        const sent = yield* callTool(app.fetchMcp, granted.accessToken, "send_message", {
          body: "送れない",
          recipientId: "missing",
        });
        yield* app.stop;
        return {
          profile: toolText(profile),
          search: toolText(search),
          sent: toolText(sent),
          userId: granted.userId,
        };
      }),
    );
    expect(JSON.parse(result.profile)).toMatchObject({ id: result.userId });
    expect(result.search).toBe(`permission_required:${MEMBER_MCP_SCOPE.search}`);
    expect(result.sent).toBe(`permission_required:${MEMBER_MCP_SCOPE.messageSend}`);
  });

  it("lets a paid member search and send only after those scopes are granted", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        yield* registerVerified("peer@example.com");
        yield* query(async (database): Promise<void> => {
          await database
            .update(user)
            .set({ name: "peer", searchable: true })
            .where(eq(user.email, "peer@example.com"));
        });
        const [peer] = yield* query((database) =>
          database.select({ id: user.id }).from(user).where(eq(user.email, "peer@example.com")),
        );
        const app = memberMcpApp(auth);
        const scope = [MEMBER_MCP_SCOPE.search, MEMBER_MCP_SCOPE.messageSend].join(" ");
        const granted = yield* tokenFor("sender@example.com", scope);
        yield* query(async (database): Promise<void> => {
          await database.insert(planSubscription).values({
            memberId: granted.userId,
            status: SUBSCRIPTION_STATUS.active,
            stripeCustomerId: "cus_sender",
            stripeSubscriptionId: "sub_sender",
            updatedAt: new Date("2026-09-20T00:00:00.000Z"),
          });
        });
        const search = yield* callTool(app.fetchMcp, granted.accessToken, "search_members", {
          keyword: "peer",
        });
        const sent = yield* callTool(app.fetchMcp, granted.accessToken, "send_message", {
          body: "こんにちは",
          recipientId: peer?.id ?? "",
        });
        const profile = yield* callTool(app.fetchMcp, granted.accessToken, "update_profile", {
          name: "sender",
          profile: "",
          socialLinks: [],
        });
        yield* app.stop;
        return {
          peerId: peer?.id,
          profile: toolText(profile),
          search: toolText(search),
          sent: toolText(sent),
        };
      }),
    );
    expect(JSON.parse(result.search).members.map((member: { id: string }) => member.id)).toContain(
      result.peerId,
    );
    expect(JSON.parse(result.sent)).toMatchObject({ conversationId: expect.any(String) });
    expect(result.profile).toBe(`permission_required:${MEMBER_MCP_SCOPE.profileUpdate}`);
  });
});
