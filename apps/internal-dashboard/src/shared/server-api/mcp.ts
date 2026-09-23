import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { APPLICATION, readWikiBindings, wikiApiBinding } from "@repo/config";
import { WikiRpcs, makeRpcClient } from "@repo/core-api";
import { reportFailure } from "@repo/observability";
import { AppOrigin, secureResponse } from "@repo/runtime/http";
import { env } from "cloudflare:workers";
import { Cause, Effect } from "effect";
import { z } from "zod";

import { authorizeMcpRequest } from "#shared/wiki/index.ts";
import { runtime } from "./runtime.ts";

import type { ServiceFetcher } from "@repo/config";
import type { RpcClient, RpcGroup } from "effect/unstable/rpc";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";

type WikiClient = RpcClient.RpcClient<RpcGroup.Rpcs<typeof WikiRpcs>, RpcClientError>;
type ToolResult = { content: { text: string; type: "text" }[]; isError?: boolean };

const mcpVersion = "1.0.0";

function text(content: string): ToolResult {
  return { content: [{ text: content, type: "text" }] };
}

function callWiki(
  binding: ServiceFetcher,
  call: (wiki: WikiClient) => Effect.Effect<ToolResult, RpcClientError>,
): Promise<ToolResult> {
  return runtime.runPromise(
    makeRpcClient(WikiRpcs, binding).pipe(
      Effect.flatMap(call),
      Effect.catchTag("RpcClientError", (error) =>
        reportFailure(Cause.fail(error)).pipe(
          Effect.as({ ...text("wiki is unavailable"), isError: true }),
        ),
      ),
      Effect.scoped,
    ),
  );
}

function createServer(binding: ServiceFetcher): McpServer {
  const server = new McpServer({ name: APPLICATION.wiki, version: mcpVersion });
  server.registerTool(
    "search",
    {
      description: "Search docs pages with a query",
      inputSchema: z.object({ query: z.string() }),
      title: "Search Docs",
    },
    ({ query }) =>
      callWiki(binding, (wiki) =>
        wiki.searchWiki({ query }).pipe(Effect.map(({ results }) => text(JSON.stringify(results)))),
      ),
  );
  server.registerTool(
    "list_pages",
    {
      description: "List all docs pages with their pathnames (URLs)",
      inputSchema: z.object({}),
      title: "List Pages",
    },
    () => callWiki(binding, (wiki) => wiki.listWikiPages({}).pipe(Effect.map(text))),
  );
  server.registerTool(
    "get_page",
    {
      description: "Get the Markdown content of a docs page by its pathname (URL)",
      inputSchema: z.object({ url: z.string() }),
      title: "Get Page",
    },
    ({ url }) =>
      callWiki(binding, (wiki) =>
        wiki.readWikiPage({ url }).pipe(
          Effect.map(text),
          Effect.catchTag("WikiPageNotFound", () =>
            Effect.succeed({ ...text(`page not found: ${url}`), isError: true }),
          ),
        ),
      ),
  );
  return server;
}

const handleMcp = Effect.fn("handleMcp")(function* handleMcp(request: Request) {
  const bindings = yield* readWikiBindings(env).pipe(Effect.orDie);
  const handler = createMcpHandler(() => createServer(bindings[wikiApiBinding]));
  return yield* Effect.promise(() => handler.fetch(request));
});

const serveMcp = Effect.fn("serveMcp")(function* serveMcp(request: Request) {
  const authorized = yield* authorizeMcpRequest(request, yield* AppOrigin);
  if (authorized instanceof Response) {
    return authorized;
  }
  return secureResponse({ httpRequest: request, httpResponse: yield* handleMcp(request) });
});

export { serveMcp };
