import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import type { WikiServices } from "@template/runtime/wiki";
import { Effect } from "effect";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";
import { searchServer, wikiLlms } from "./search.ts";
import { source } from "./source.ts";

export const handleMcp = (request: Request) =>
  Effect.gen(function* () {
    const search = searchServer(yield* Effect.context<WikiServices>());
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "wiki", version: "1.0.0" });
      registerSearchTool(server, search);
      registerSourceTools(server, source, wikiLlms);
      return server;
    });
    return yield* Effect.promise(() => handler.fetch(request));
  });
