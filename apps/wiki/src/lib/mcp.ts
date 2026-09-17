import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";
import type { SearchServer } from "fumadocs-core/search/server";
import { source } from "./source.ts";
import { wikiLlms } from "./search.ts";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function handleMcp(request: Request, search: SearchServer): Promise<Response> {
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "wiki", version: "1.0.0" });
    registerSearchTool(server, search);
    registerSourceTools(server, source, wikiLlms);
    return server;
  });
  return handler.fetch(request);
}

export { handleMcp };
