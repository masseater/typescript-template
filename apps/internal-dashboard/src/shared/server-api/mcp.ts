import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { APPLICATION } from "@repo/config";
import { AppOrigin, secureResponse } from "@repo/runtime/http";
import { Effect } from "effect";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";

import { source } from "#shared/content/index.ts";
import { authorizeMcpRequest } from "#shared/wiki/index.ts";
import { searchServer, wikiLlms } from "./search.ts";

import type { WikiServices } from "#shared/wiki/index.ts";
import type { Context } from "effect";

const mcpVersion = "1.0.0";

function createServer(context: Context.Context<WikiServices>): McpServer {
  const server = new McpServer({ name: APPLICATION.wiki, version: mcpVersion });
  registerSearchTool(server, searchServer(context));
  registerSourceTools(server, source, wikiLlms);
  return server;
}

function handleMcp(request: Request): Effect.Effect<Response, never, WikiServices> {
  return Effect.gen(function* handleMcpRequest() {
    const context = yield* Effect.context<WikiServices>();
    const handler = createMcpHandler(() => createServer(context));
    return yield* Effect.promise(() => handler.fetch(request));
  });
}

const serveMcp = Effect.fn("serveMcp")(function* serveMcp(request: Request) {
  const authorized = yield* authorizeMcpRequest(request, yield* AppOrigin);
  if (authorized instanceof Response) {
    return authorized;
  }
  return secureResponse({ httpRequest: request, httpResponse: yield* handleMcp(request) });
});

export { serveMcp };
