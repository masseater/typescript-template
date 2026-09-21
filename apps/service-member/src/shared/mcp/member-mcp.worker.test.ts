import { Auth } from "@repo/auth";
import { AuthApps, authTest, authTestSecret, runWith } from "@repo/auth/testing";
import { APPLICATION, MEMBER_MCP_CAPABILITY, SUBSCRIPTION_STATUS } from "@repo/config";
import { query, recordSubscription, schema } from "@repo/db";
import { httpStatus } from "@repo/observability";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoutes, createApi, unavailable } from "@repo/runtime/http";
import { appEnvironment } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { describe, expect } from "vite-plus/test";

import { routes } from "#shared/telemetry/index.ts";
import { replaceMcpGrants } from "./grants.ts";
import { serveMcp } from "./mcp.ts";
import {
  callTool,
  mcpChallenge,
  memberOrigin,
  memberTokens,
  responseStatus,
  type FetchMcp,
} from "./member-oauth-fixture.ts";

const { user } = schema;
const secretBody = "MCP_SECRET_BODY_NOT_FOR_OTHER_TOOLS";
const reporting = { service: APPLICATION.user } as const;

const discovery = Effect.fn("discovery")(function* discovery(path: string) {
  const member = (yield* AuthApps)[APPLICATION.user];
  const response = yield* Effect.promise(async () =>
    member.instance.handler(new Request(`${memberOrigin}${path}`)),
  );
  const body = yield* Effect.promise(async (): Promise<unknown> => response.json());
  return { body, status: response.status };
});

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
          appEnvironment({ APP_ORIGIN: memberOrigin, AUTH_SECRET: authTestSecret }),
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

const idOf = Effect.fn("idOf")(function* idOf(email: string) {
  const [row] = yield* query((database) =>
    database.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1),
  );
  if (row === undefined) {
    return yield* Effect.die(`missing member ${email}`);
  }
  return row.id;
});

const toolText = (body: unknown): string => {
  if (typeof body !== "object" || body === null || !("result" in body)) {
    return "";
  }
  const result = body.result;
  if (typeof result !== "object" || result === null || !("content" in result)) {
    return "";
  }
  const content = result.content;
  if (!Array.isArray(content)) {
    return "";
  }
  const [first] = content;
  return typeof first === "object" &&
    first !== null &&
    "text" in first &&
    typeof first.text === "string"
    ? first.text
    : "";
};

describe("member MCP authorization", () => {
  const it = authTest();

  it("publishes OAuth discovery for the member MCP resource", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        const app = memberMcpApp(auth);
        const resource = yield* discovery("/.well-known/oauth-protected-resource/mcp");
        const server = yield* discovery("/.well-known/oauth-authorization-server/api/auth");
        const challenge = yield* mcpChallenge();
        const header =
          challenge instanceof Response ? challenge.headers.get("www-authenticate") : "";
        yield* app.stop;
        return {
          challengeStatus: responseStatus(challenge),
          header: header ?? "",
          resource,
          server,
        };
      }),
    );
    expect(result.resource.status).toBe(httpStatus.ok);
    expect(result.resource.body).toMatchObject({
      authorization_servers: [`${memberOrigin}/api/auth`],
      resource: `${memberOrigin}/mcp`,
    });
    expect(result.server.body).toMatchObject({
      issuer: `${memberOrigin}/api/auth`,
      registration_endpoint: `${memberOrigin}/api/auth/oauth2/register`,
    });
    expect(result.challengeStatus).toBe(httpStatus.unauthorized);
    expect(result.header).toContain(
      `resource_metadata="${memberOrigin}/.well-known/oauth-protected-resource/mcp"`,
    );
  });

  it("rejects ungranted tools and allows the tools the member granted", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        const owner = yield* memberTokens("owner@example.com");
        const ownerId = yield* idOf(owner.email);
        const peer = yield* memberTokens("peer@example.com");
        const peerId = yield* idOf(peer.email);
        yield* query(async (database) => {
          await database
            .update(user)
            .set({ name: "peer", searchable: true })
            .where(eq(user.id, peerId));
        });
        const app = memberMcpApp(auth);
        const deniedProfile = yield* callTool(
          app.fetchMcp,
          owner.tokens.access_token,
          "get_profile",
        );
        const deniedSend = yield* callTool(
          app.fetchMcp,
          owner.tokens.access_token,
          "send_message",
          {
            body: secretBody,
            recipientId: peerId,
          },
        );
        yield* replaceMcpGrants(ownerId, [
          MEMBER_MCP_CAPABILITY.profileRead,
          MEMBER_MCP_CAPABILITY.messageSend,
        ]);
        const profile = yield* callTool(app.fetchMcp, owner.tokens.access_token, "get_profile");
        const unpaidSend = yield* callTool(
          app.fetchMcp,
          owner.tokens.access_token,
          "send_message",
          {
            body: secretBody,
            recipientId: peerId,
          },
        );
        yield* recordSubscription(
          { createdAt: new Date("2026-09-20T00:00:00.000Z"), id: "evt_owner", type: "updated" },
          {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z"),
            memberId: ownerId,
            status: SUBSCRIPTION_STATUS.active,
            stripeCustomerId: "cus_owner",
            stripeSubscriptionId: "sub_owner",
          },
        );
        const sent = yield* callTool(app.fetchMcp, owner.tokens.access_token, "send_message", {
          body: secretBody,
          recipientId: peerId,
        });
        const deniedSearch = yield* callTool(
          app.fetchMcp,
          owner.tokens.access_token,
          "search_members",
          {
            keyword: "peer",
          },
        );
        yield* replaceMcpGrants(ownerId, [MEMBER_MCP_CAPABILITY.memberSearch]);
        const searched = yield* callTool(
          app.fetchMcp,
          owner.tokens.access_token,
          "search_members",
          {
            keyword: "peer",
          },
        );
        const profileAfterRevoke = yield* callTool(
          app.fetchMcp,
          owner.tokens.access_token,
          "get_profile",
        );
        yield* app.stop;
        return {
          deniedProfile,
          deniedSearch,
          deniedSend,
          profile,
          profileAfterRevoke,
          searched,
          sent,
          unpaidSend,
        };
      }),
    );
    expect(toolText(result.deniedProfile)).toBe("grant_required");
    expect(toolText(result.deniedSend)).toBe("grant_required");
    expect(toolText(result.unpaidSend)).toBe("paid_required");
    expect(toolText(result.deniedSearch)).toBe("grant_required");
    expect(toolText(result.profileAfterRevoke)).toBe("grant_required");
    expect(toolText(result.profile)).toContain("owner@example.com");
    expect(toolText(result.profile)).not.toContain(secretBody);
    expect(toolText(result.sent)).toContain("conversationId");
    expect(toolText(result.sent)).not.toContain(secretBody);
    expect(toolText(result.searched)).toContain("peer");
    expect(toolText(result.searched)).not.toContain(secretBody);
  });
});
