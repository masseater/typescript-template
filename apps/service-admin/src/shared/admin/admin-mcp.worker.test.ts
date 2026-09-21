import { Auth } from "@repo/auth";
import {
  AuthApps,
  adminOperator,
  authTest,
  runWith,
  startAdminAuthorization,
} from "@repo/auth/testing";
import { APPLICATION } from "@repo/config";
import { ADMIN_PERMISSION } from "@repo/config/identity";
import { addUser, auditActionsOf } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoutes, createApi, unavailable } from "@repo/runtime/http";
import { appEnvironment } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { Context, Effect, Layer } from "effect";
import { describe, expect } from "vite-plus/test";

import { routes } from "#shared/telemetry/index.ts";
import {
  callTool,
  exchangeCode,
  grantAuthorization,
  mcpChallenge,
  mcpRequest,
  responseStatus,
} from "./admin-oauth-fixture.ts";
import { serveMcp } from "./mcp.ts";

import type { FetchMcp } from "./admin-oauth-fixture.ts";

const adminOrigin = "http://127.0.0.1:3002";
const authSecret = "integration-test-secret-at-least-32-characters-long";
const reporting = { service: APPLICATION.admin } as const;

const discovery = Effect.fn("discovery")(function* discovery(path: string) {
  const admin = (yield* AuthApps)[APPLICATION.admin];
  const response = yield* Effect.promise(async () =>
    admin.instance.handler(new Request(`${adminOrigin}${path}`)),
  );
  const body = yield* Effect.promise(async (): Promise<unknown> => response.json());
  return { body, status: response.status };
});

function adminMcpApp(auth: Parameters<typeof runWith>[0]): {
  fetchMcp: FetchMcp;
  stop: Effect.Effect<void>;
} {
  const adminAuth = Context.get(auth, AuthApps)[APPLICATION.admin];
  const runtime = workerRuntime(() =>
    Layer.orDie(
      Layer.merge(
        Layer.succeed(Auth, adminAuth),
        appLayer(
          appEnvironment({ APP_ORIGIN: adminOrigin, AUTH_SECRET: authSecret }),
          APPLICATION.admin,
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

const authorizedTokens = Effect.fn("authorizedTokens")(function* authorizedTokens(
  permission: (typeof ADMIN_PERMISSION)[keyof typeof ADMIN_PERMISSION],
) {
  const flow = yield* startAdminAuthorization();
  const admin = yield* adminOperator("owner@example.com", permission);
  const code = yield* grantAuthorization(admin, flow.oauthQuery);
  return { tokens: yield* exchangeCode(flow, code) };
});

describe("admin MCP authorization", () => {
  const it = authTest();

  it("admin publishes OAuth discovery for its MCP resource", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        const app = adminMcpApp(auth);
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
      authorization_servers: [`${adminOrigin}/api/auth`],
      resource: `${adminOrigin}/mcp`,
    });
    expect(result.server.body).toMatchObject({
      code_challenge_methods_supported: ["S256"],
      issuer: `${adminOrigin}/api/auth`,
      registration_endpoint: `${adminOrigin}/api/auth/oauth2/register`,
    });
    expect(result.challengeStatus).toBe(httpStatus.unauthorized);
    expect(result.header).toContain(
      `resource_metadata="${adminOrigin}/.well-known/oauth-protected-resource/mcp"`,
    );
  });

  it("rejects mutating MCP tools for a read-only administrator", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        yield* addUser({ userId: "member" });
        const app = adminMcpApp(auth);
        const { tokens } = yield* authorizedTokens(ADMIN_PERMISSION.viewer);
        const search = yield* callTool(app.fetchMcp, tokens.access_token, "search_members");
        const suspend = yield* callTool(app.fetchMcp, tokens.access_token, "suspend_member", {
          memberId: "member",
        });
        yield* app.stop;
        return { search, suspend };
      }),
    );
    expect(result.search).toMatchObject({ result: { content: [{ type: "text" }] } });
    expect(result.suspend).toMatchObject({
      result: { content: [{ text: "permission_required" }], isError: true },
    });
  });

  it("lets an operate-tier administrator search members through OAuth", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        yield* addUser({ userId: "member" });
        const app = adminMcpApp(auth);
        const { tokens } = yield* authorizedTokens(ADMIN_PERMISSION.operator);
        const searched = yield* callTool(app.fetchMcp, tokens.access_token, "search_members");
        yield* app.stop;
        const parsed = JSON.parse(
          (searched as { result: { content: [{ text: string }] } }).result.content[0]?.text ?? "{}",
        );
        return parsed;
      }),
    );
    expect(result.users.map((user: { id: string }) => user.id)).toContain("member");
  });

  it("marks MCP-originated suspensions in the audit log", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        yield* addUser({ userId: "member" });
        const app = adminMcpApp(auth);
        const { tokens } = yield* authorizedTokens(ADMIN_PERMISSION.operator);
        yield* callTool(app.fetchMcp, tokens.access_token, "suspend_member", {
          memberId: "member",
        });
        const audit = yield* auditActionsOf("member");
        yield* app.stop;
        return audit;
      }),
    );
    expect(result).toStrictEqual([
      {
        action: "member_suspended",
        actorId: expect.stringMatching(/.+/u),
        actorKind: "admin",
        channel: "mcp",
      },
    ]);
  });

  it("strong administrator authorizes an MCP client that can then call the server", async ({
    auth,
  }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        const app = adminMcpApp(auth);
        const { tokens } = yield* authorizedTokens(ADMIN_PERMISSION.operator);
        const granted = yield* mcpRequest(app.fetchMcp, tokens.access_token, {
          id: 0,
          jsonrpc: "2.0",
          method: "tools/list",
        });
        yield* app.stop;
        const body =
          granted instanceof Response
            ? yield* Effect.promise(async (): Promise<unknown> => {
                const contentType = granted.headers.get("content-type") ?? "";
                if (contentType.includes("application/json")) {
                  return granted.json();
                }
                const text = await granted.text();
                const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
                return JSON.parse(dataLine?.slice("data: ".length) ?? "{}");
              })
            : granted;
        return {
          grantedStatus: body !== undefined ? httpStatus.ok : httpStatus.internalServerError,
        };
      }),
    );
    expect(result.grantedStatus).toBe(httpStatus.ok);
  });
});
