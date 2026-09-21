import { verifySession } from "@repo/auth";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { Effect } from "effect";

import { McpGrants } from "#shared/contracts/index.ts";
import { listMcpGrants, replaceMcpGrants } from "#shared/mcp/index.ts";
import { memberFailures } from "./member-failures.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

function mcpGrantsApi(api: ApiRoutes<AppServices>) {
  return createApi("/mcp")
    .get(
      "/grants",
      api.route(
        McpGrants,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { capabilities: yield* listMcpGrants(user.id) };
          }),
        memberFailures,
      ),
    )
    .put(
      "/grants",
      api.route(
        McpGrants,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { capabilities } = yield* readJsonBody(McpGrants, request);
            return { capabilities: yield* replaceMcpGrants(user.id, capabilities) };
          }),
        memberFailures,
      ),
    );
}

export { mcpGrantsApi };
