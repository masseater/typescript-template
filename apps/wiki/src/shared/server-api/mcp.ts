import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { authorizeMcpRequest } from "@repo/auth/mcp";
import { AppOrigin, secureResponse } from "@repo/runtime/http";
import { Effect } from "effect";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";

import { source } from "#shared/content/index.ts";
import { searchServer, wikiLlms } from "./search.ts";

import type { WikiServices } from "#shared/wiki/wiki.ts";
import type { Context } from "effect";

const mcpVersion = "1.0.0";

function createServer(context: Context.Context<WikiServices>): McpServer {
  const server = new McpServer({ name: "wiki", version: mcpVersion });
  registerSearchTool(server, searchServer(context));
  registerSourceTools(server, source, wikiLlms);
  return server;
}

function handleMcp(request: Request): Effect.Effect<Response, never, WikiServices> {
  return Effect.gen(function* handleMcpRequest() {
    const context = yield* Effect.context<WikiServices>();
    const handler = createMcpHandler(() => createServer(context));
    return yield* Effect.promise(async () => handler.fetch(request));
  });
}

const serveMcp = Effect.fn("serveMcp")(function* serveMcp(request: Request) {
  const authorized = yield* authorizeMcpRequest(request, yield* AppOrigin);
  if (authorized instanceof Response) {
    return authorized;
  }
  return secureResponse(request, yield* handleMcp(request));
});

export { serveMcp };
