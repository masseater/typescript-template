import { Auth } from "@repo/auth";
import { AuthApps, authTest, authTestSecret, runWith } from "@repo/auth/testing";
import { APPLICATION, MEMBER_MCP_SCOPE, SUBSCRIPTION_STATUS, httpStatus } from "@repo/config";
import { eq, query, recordSubscription, schema } from "@repo/db";
import { unavailable } from "@repo/runtime/account";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { Context, DateTime, Effect, Layer, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { routes } from "#shared/telemetry/index.ts";
import { serveMcp } from "./mcp.ts";
import {
  callTool,
  mcpChallenge,
  memberOrigin,
  responseStatus,
  tokenFor,
  type FetchMcp,
} from "./member-oauth-fixture.ts";

const { user } = schema;
const secretBody = "MCP_SECRET_BODY_NOT_FOR_OTHER_TOOLS";
const reporting = { service: APPLICATION.user } as const;
const JsonUnknown = Schema.fromJsonString(Schema.Unknown);

const discovery = Effect.fn("discovery")(function* discovery(path: string) {
  const member = (yield* AuthApps)[APPLICATION.user];
  const handler = member.instance.handler;
  if (typeof handler !== "function") {
    return yield* Effect.die("MEMBER_HANDLER_UNAVAILABLE");
  }
  const response: unknown = yield* Effect.promise(() =>
    Promise.resolve(handler(new Request(`${memberOrigin}${path}`))),
  );
  if (!(response instanceof Response)) {
    return yield* Effect.die("MEMBER_HANDLER_UNAVAILABLE");
  }
  const text = yield* Effect.promise(() => response.text());
  const body = yield* Schema.decodeEffect(JsonUnknown)(text);
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
  const app = createApi("").all("/mcp", ...api.raw(serveMcp, unavailable));
  const fetchMcp = (request: Request): Effect.Effect<Response, never, never> =>
    Effect.promise(() => Promise.resolve(app.fetch(request)));
  return {
    fetchMcp,
    stop: Effect.promise(() => Promise.resolve(runtime.dispose()).then(() => undefined)),
  };
}

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

  it("publishes OAuth discovery for the member MCP resource", ({ auth }) =>
    runWith(auth, () =>
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
    ).then((result) => {
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
    }));

  it("rejects tools the member did not permit and allows the scopes they granted", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        yield* tokenFor("peer@example.com", MEMBER_MCP_SCOPE.profileRead);
        yield* query((database) =>
          database
            .update(user)
            .set({ name: "peer", searchable: true })
            .where(eq(user.email, "peer@example.com"))
            .then(() => undefined),
        );
        const [peer] = yield* query((database) =>
          database.select({ id: user.id }).from(user).where(eq(user.email, "peer@example.com")),
        );
        const grantedRead = yield* tokenFor("reader@example.com", MEMBER_MCP_SCOPE.profileRead);
        const app = memberMcpApp(auth);
        const profile = yield* callTool(app.fetchMcp, grantedRead.accessToken, "get_profile");
        const deniedSearch = yield* callTool(
          app.fetchMcp,
          grantedRead.accessToken,
          "search_members",
        );
        const deniedSend = yield* callTool(app.fetchMcp, grantedRead.accessToken, "send_message", {
          body: secretBody,
          recipientId: "missing",
        });
        const scope = [MEMBER_MCP_SCOPE.search, MEMBER_MCP_SCOPE.messageSend].join(" ");
        const granted = yield* tokenFor("sender@example.com", scope);
        yield* recordSubscription(
          {
            createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z")),
            id: "evt_sender",
            type: "updated",
          },
          {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: DateTime.toDate(DateTime.makeUnsafe("2099-01-01T00:00:00.000Z")),
            memberId: granted.userId,
            status: SUBSCRIPTION_STATUS.active,
            stripeCustomerId: "cus_sender",
            stripeSubscriptionId: "sub_sender",
          },
        );
        const searched = yield* callTool(app.fetchMcp, granted.accessToken, "search_members", {
          keyword: "peer",
        });
        const sent = yield* callTool(app.fetchMcp, granted.accessToken, "send_message", {
          body: "こんにちは",
          recipientId: peer?.id ?? "",
        });
        const deniedProfile = yield* callTool(app.fetchMcp, granted.accessToken, "update_profile", {
          name: "sender",
          profile: "",
          socialLinks: [],
        });
        yield* app.stop;
        const profileText = toolText(profile);
        const searchedText = toolText(searched);
        const sentText = toolText(sent);
        return {
          deniedProfile: toolText(deniedProfile),
          deniedSearch: toolText(deniedSearch),
          deniedSend: toolText(deniedSend),
          peerId: peer?.id,
          profile: yield* Schema.decodeEffect(JsonUnknown)(profileText || "{}"),
          searched: yield* Schema.decodeEffect(JsonUnknown)(searchedText || "{}"),
          sent: yield* Schema.decodeEffect(JsonUnknown)(sentText || "{}"),
          sentText,
          userId: grantedRead.userId,
        };
      }),
    ).then((result) => {
      expect(result.profile).toMatchObject({ id: result.userId });
      expect(result.deniedSearch).toBe(`permission_required:${MEMBER_MCP_SCOPE.search}`);
      expect(result.deniedSend).toBe(`permission_required:${MEMBER_MCP_SCOPE.messageSend}`);
      expect(
        (result.searched as { members: readonly { id: string }[] }).members.map(
          (member) => member.id,
        ),
      ).toContain(result.peerId);
      expect(result.sent).toMatchObject({ conversationId: expect.any(String) });
      expect(result.sentText).not.toContain(secretBody);
      expect(result.deniedProfile).toBe(`permission_required:${MEMBER_MCP_SCOPE.profileUpdate}`);
    }));
});
