import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";
import type { SearchServer } from "fumadocs-core/search/server";
import { wikiLlms } from "./search.ts";
import { source } from "./source.ts";

export function handleMcp(request: Request, search: SearchServer) {
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "wiki", version: "1.0.0" });
    registerSearchTool(server, search);
    registerSourceTools(server, source, wikiLlms);
    return server;
  });
  return handler.fetch(request);
}
