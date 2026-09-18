import { AppOrigin, secureResponse } from "@repo/runtime/http";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";
import { searchServer, wikiLlms } from "./search.ts";
import type { Context } from "effect";
import { Effect } from "effect";
import type { WikiServices } from "@repo/runtime/wiki";
import { authorizeMcpRequest } from "@repo/auth/mcp";
import { source } from "#shared/content/index.ts";

const mcpVersion = "1.0.0";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createServer(context: Context.Context<WikiServices>): McpServer {
  const server = new McpServer({ name: "wiki", version: mcpVersion });
  registerSearchTool(server, searchServer(context));
  registerSourceTools(server, source, wikiLlms);
  return server;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function handleMcp(request: Request): Effect.Effect<Response, never, WikiServices> {
  return Effect.gen(function* handleMcpRequest() {
    const context = yield* Effect.context<WikiServices>();
    const handler = createMcpHandler(() => createServer(context));
    return yield* Effect.promise(async () => handler.fetch(request));
  });
}

const serveMcp = Effect.fn("serveMcp")(function* serveMcp(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
) {
  const authorized = yield* authorizeMcpRequest(request, yield* AppOrigin);
  if (authorized instanceof Response) {
    return authorized;
  }
  return secureResponse(yield* handleMcp(request));
});

export { serveMcp };
