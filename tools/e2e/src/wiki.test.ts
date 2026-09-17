import { expect, test } from "vitest";
import { createStack } from "./stack.ts";
import { ensure, object, string, safeFailure } from "./support.ts";
import { verifyBrowserSignals, verifyCorrelation } from "./telemetry.ts";

async function mcp(origin: string, id: number, method: string, params: Record<string, unknown>) {
  const response = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  ensure(response.ok, "E2E_WIKI_MCP_REQUEST_FAILED");
  const text = await response.text();
  const payload = text.startsWith("{")
    ? text
    : text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("");
  return {
    result: object(object(JSON.parse(payload) as unknown)["result"]),
    requestId: response.headers.get("x-request-id"),
    traceparent: response.headers.get("traceparent"),
  };
}

function toolText(result: Record<string, unknown>) {
  const content = result["content"];
  ensure(Array.isArray(content), "E2E_WIKI_MCP_CONTENT_MISSING");
  return string(object(content[0])["text"]);
}

test("public wiki Worker: Markdown pages, semantic search UI, MCP tools and correlated telemetry", async () => {
  const stack = await createStack();
  let stage = "pages";
  try {
    const started = Math.floor(Date.now() / 1000);
    const reader = stack.browser("wiki-reader");
    await reader.open(stack.wikiOrigin, "/");
    await reader.waitText("この wiki は");
    await reader.open(stack.wikiOrigin, "/database");
    await reader.waitText("適用済みのマイグレーションファイルは書き換えません。");

    stage = "application-isolation";
    for (const pathname of ["/api/users", "/api/auth/get-session", "/api/profile"]) {
      const response = await fetch(`${stack.wikiOrigin}${pathname}`, {
        signal: AbortSignal.timeout(5000),
      });
      ensure(response.status === 404, "E2E_APPLICATION_ROUTE_EXPOSED_BY_WIKI");
    }

    stage = "semantic-search";
    const search = await reader.api(
      `/api/search?${new URLSearchParams({ query: "パスワードを使わずにサインインしたい" }).toString()}`,
    );
    ensure(search.status === 200 && Array.isArray(search.data), "E2E_WIKI_SEARCH_FAILED");
    ensure(object(search.data[0])["url"] === "/authentication", "E2E_WIKI_SEMANTIC_RANKING_WRONG");
    await verifyCorrelation(search, "wiki", []);
    await reader.commands(
      ["find", "role", "button", "click", "--name", "検索 ⌘ K", "--exact"],
      ["wait", 'input[placeholder="検索"]'],
      ["fill", 'input[placeholder="検索"]', "テーブル定義を変えたい"],
      ["wait", "--text", "差分から SQL を生成します。"],
    );

    stage = "mcp";
    const tools = await mcp(stack.wikiOrigin, 1, "tools/list", {});
    const names = tools.result["tools"];
    ensure(Array.isArray(names), "E2E_WIKI_MCP_TOOLS_MISSING");
    const toolNames = names.map((tool: unknown) => string(object(tool)["name"])).sort();
    ensure(toolNames.join(",") === "get_page,list_pages,search", "E2E_WIKI_MCP_TOOLS_UNEXPECTED");
    const found = await mcp(stack.wikiOrigin, 2, "tools/call", {
      name: "search",
      arguments: { query: "本番に反映したい" },
    });
    const results: unknown = JSON.parse(toolText(found.result));
    ensure(
      Array.isArray(results) && object(results[0])["url"] === "/deploy",
      "E2E_WIKI_MCP_SEMANTIC_RANKING_WRONG",
    );
    await verifyCorrelation(found, "wiki", []);
    const page = await mcp(stack.wikiOrigin, 3, "tools/call", {
      name: "get_page",
      arguments: { url: "/deploy" },
    });
    expect(toolText(page.result)).toContain("pnpm infra:deploy:wiki");

    stage = "browser-telemetry";
    await reader.evaluate(
      'setTimeout(() => { throw new Error("E2E wiki browser exception"); }, 0); true',
    );
    await reader.open(stack.wikiOrigin, "/");
    await verifyBrowserSignals("wiki", started);
  } catch (error) {
    throw safeFailure(error, stage);
  } finally {
    await stack.cleanup();
  }
});
