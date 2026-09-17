import { currentSecond, verifyBrowserSignals, verifyCorrelation } from "./telemetry.ts";
import { describe, expect, it } from "vitest";
import { ensure, inStage, object, string } from "./support.ts";
import { httpStatus, requestTimeout } from "./http.ts";
import type { BrowserSession } from "./browser.ts";
import type { Stack } from "./stack.ts";
import { createStack } from "./stack.ts";

interface McpRequest {
  readonly id: number;
  readonly method: string;
  readonly params: Readonly<Record<string, unknown>>;
}

interface McpResponse {
  readonly requestId: string | null;
  readonly result: Record<string, unknown>;
  readonly traceparent: string | null;
}

interface WikiContext {
  readonly reader: BrowserSession;
  readonly stack: Stack;
  readonly started: number;
}

const mcpRequestIds = { getPage: 3, listTools: 1, search: 2 };
const applicationRoutes = ["/api/users", "/api/auth/get-session", "/api/profile"];

function eventStreamPayload(text: string): string {
  if (text.startsWith("{")) {
    return text;
  }
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length))
    .join("");
}

async function mcp(origin: string, request: McpRequest): Promise<McpResponse> {
  const response = await fetch(`${origin}/mcp`, {
    body: JSON.stringify({
      id: request.id,
      jsonrpc: "2.0",
      method: request.method,
      params: request.params,
    }),
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
    },
    method: "POST",
    signal: AbortSignal.timeout(requestTimeout.long),
  });
  ensure(response.ok, "E2E_WIKI_MCP_REQUEST_FAILED");
  const payload = eventStreamPayload(await response.text());
  return {
    requestId: response.headers.get("x-request-id"),
    result: object(object(JSON.parse(payload) as unknown)["result"]),
    traceparent: response.headers.get("traceparent"),
  };
}

function toolText(result: Readonly<Record<string, unknown>>): string {
  const { content } = result;
  ensure(Array.isArray(content), "E2E_WIKI_MCP_CONTENT_MISSING");
  return string(object(content[0])["text"]);
}

async function openPages(stack: Stack): Promise<WikiContext> {
  const started = currentSecond();
  const reader = stack.browser("wiki-reader");
  await reader.open(stack.wikiOrigin, "/");
  await reader.waitText("この wiki は");
  await reader.open(stack.wikiOrigin, "/database");
  await reader.waitText("適用済みのマイグレーションファイルは書き換えません。");
  return { reader, stack, started };
}

async function verifyApplicationIsolation(context: WikiContext): Promise<void> {
  await Promise.all(
    applicationRoutes.map(async (pathname) => {
      const response = await fetch(`${context.stack.wikiOrigin}${pathname}`, {
        signal: AbortSignal.timeout(requestTimeout.short),
      });
      ensure(response.status === httpStatus.notFound, "E2E_APPLICATION_ROUTE_EXPOSED_BY_WIKI");
    }),
  );
}

async function verifySearch(context: WikiContext): Promise<void> {
  const { reader } = context;
  const search = await reader.api(
    `/api/search?${new URLSearchParams({ query: "パスキー" }).toString()}`,
  );
  ensure(search.status === httpStatus.ok && Array.isArray(search.data), "E2E_WIKI_SEARCH_FAILED");
  ensure(object(search.data[0])["url"] === "/authentication", "E2E_WIKI_KEYWORD_RANKING_WRONG");
  await verifyCorrelation(search, { forbidden: [], service: "wiki" });
  await reader.commands(
    ["find", "role", "button", "click", "--name", "検索 ⌘ K", "--exact"],
    ["wait", 'input[placeholder="検索"]'],
    ["fill", 'input[placeholder="検索"]', "マイグレーション"],
    ["wait", "--text", "差分から SQL を生成します。"],
  );
}

async function verifyToolList(wikiOrigin: string): Promise<void> {
  const tools = await mcp(wikiOrigin, {
    id: mcpRequestIds.listTools,
    method: "tools/list",
    params: {},
  });
  const names = tools.result["tools"];
  ensure(Array.isArray(names), "E2E_WIKI_MCP_TOOLS_MISSING");
  const toolNames = names.map((tool: unknown) => string(object(tool)["name"])).toSorted();
  ensure(toolNames.join(",") === "get_page,list_pages,search", "E2E_WIKI_MCP_TOOLS_UNEXPECTED");
}

async function verifyMcpTools(context: WikiContext): Promise<string> {
  const { wikiOrigin } = context.stack;
  await verifyToolList(wikiOrigin);
  const found = await mcp(wikiOrigin, {
    id: mcpRequestIds.search,
    method: "tools/call",
    params: { arguments: { query: "infra:deploy:shared" }, name: "search" },
  });
  const results: unknown = JSON.parse(toolText(found.result));
  ensure(
    Array.isArray(results) && object(results[0])["url"] === "/deploy",
    "E2E_WIKI_MCP_KEYWORD_RANKING_WRONG",
  );
  await verifyCorrelation(found, { forbidden: [], service: "wiki" });
  const page = await mcp(wikiOrigin, {
    id: mcpRequestIds.getPage,
    method: "tools/call",
    params: { arguments: { url: "/deploy" }, name: "get_page" },
  });
  return toolText(page.result);
}

async function verifyWikiBrowserSignals(context: WikiContext): Promise<void> {
  await context.reader.evaluate(
    'setTimeout(() => { throw new Error("E2E wiki browser exception"); }, 0); true',
  );
  await context.reader.open(context.stack.wikiOrigin, "/");
  await verifyBrowserSignals("wiki", context.started);
}

describe("public wiki Worker", () => {
  it("serves Markdown pages, keyword search without Workers AI, MCP tools and correlated telemetry", async () => {
    expect.hasAssertions();
    const stack = await createStack();
    try {
      const context = await inStage("pages", openPages, stack);
      await inStage("application-isolation", verifyApplicationIsolation, context);
      await inStage("search", verifySearch, context);
      const deployPage = await inStage("mcp", verifyMcpTools, context);
      expect(deployPage).toContain("pnpm infra:deploy:wiki");
      await inStage("browser-telemetry", verifyWikiBrowserSignals, context);
    } finally {
      await stack.cleanup();
    }
  });
});
