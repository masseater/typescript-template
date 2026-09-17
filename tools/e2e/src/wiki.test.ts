import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { createStack } from "./stack.ts";
import { ensure, fail, field, object, fetchResponse, staged, string } from "./support.ts";
import { verifyBrowserSignals, verifyCorrelation, verifyExplorerBoundary } from "./telemetry.ts";

const mcp = Effect.fn("mcp")(function* (
  origin: string,
  id: number,
  method: string,
  params: Record<string, unknown>,
) {
  const response = yield* fetchResponse(`${origin}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    timeout: 30_000,
  });
  yield* ensure(response.ok, "E2E_WIKI_MCP_REQUEST_FAILED");
  const text = yield* Effect.tryPromise(() => response.text());
  const payload = text.startsWith("{")
    ? text
    : text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("");
  return {
    result: yield* object(
      yield* field(yield* Effect.try((): unknown => JSON.parse(payload)), "result"),
    ),
    requestId: response.headers.get("x-request-id"),
    traceparent: response.headers.get("traceparent"),
  };
});

const toolText = Effect.fn("toolText")(function* (result: Record<string, unknown>) {
  const content = result["content"];
  if (!Array.isArray(content)) return yield* fail("E2E_WIKI_MCP_CONTENT_MISSING");
  return yield* string(yield* field(content[0], "text"));
});

it.live(
  "public wiki Worker: Markdown pages, keyword search without Workers AI, MCP tools and correlated telemetry",
  () => {
    let stage = "pages";
    return Effect.gen(function* () {
      const stack = yield* createStack();
      yield* Effect.gen(function* () {
        const started = Date.now();
        const reader = stack.browser("wiki-reader");
        yield* reader.open(stack.wikiOrigin, "/");
        yield* reader.waitText("この wiki は");
        yield* reader.open(stack.wikiOrigin, "/database");
        yield* reader.waitText("適用済みのマイグレーションファイルは書き換えません。");

        stage = "application-isolation";
        for (const pathname of ["/api/users", "/api/auth/get-session", "/api/profile"]) {
          const response = yield* fetchResponse(`${stack.wikiOrigin}${pathname}`, {
            timeout: 5000,
          });
          yield* ensure(response.status === 404, "E2E_APPLICATION_ROUTE_EXPOSED_BY_WIKI");
        }

        stage = "search";
        const search = yield* reader.api(
          `/api/search?${new URLSearchParams({ query: "パスキー" }).toString()}`,
        );
        yield* ensure(
          search.status === 200 && Array.isArray(search.data),
          "E2E_WIKI_SEARCH_FAILED",
        );
        yield* ensure(
          (yield* object(Array.isArray(search.data) ? search.data[0] : undefined))["url"] ===
            "/authentication",
          "E2E_WIKI_KEYWORD_RANKING_WRONG",
        );
        yield* verifyCorrelation(stack.wikiOrigin, search, "wiki", []);
        yield* reader.commands(
          ["find", "role", "button", "click", "--name", "検索 ⌘ K", "--exact"],
          ["wait", 'input[placeholder="検索"]'],
          ["fill", 'input[placeholder="検索"]', "マイグレーション"],
          ["wait", "--text", "差分から SQL を生成します。"],
        );

        stage = "mcp";
        const tools = yield* mcp(stack.wikiOrigin, 1, "tools/list", {});
        const names = tools.result["tools"];
        yield* ensure(Array.isArray(names), "E2E_WIKI_MCP_TOOLS_MISSING");
        const toolNames = (yield* Effect.forEach(Array.isArray(names) ? names : [], (tool) =>
          Effect.flatMap(field(tool, "name"), string),
        )).sort();
        yield* ensure(
          toolNames.join(",") === "get_page,list_pages,search",
          "E2E_WIKI_MCP_TOOLS_UNEXPECTED",
        );
        const found = yield* mcp(stack.wikiOrigin, 2, "tools/call", {
          name: "search",
          arguments: { query: "infra:deploy:shared" },
        });
        const foundText = yield* toolText(found.result);
        const results = yield* Effect.try((): unknown => JSON.parse(foundText));
        yield* ensure(
          Array.isArray(results) && (yield* object(results[0]))["url"] === "/deploy",
          "E2E_WIKI_MCP_KEYWORD_RANKING_WRONG",
        );
        yield* verifyCorrelation(stack.wikiOrigin, found, "wiki", []);
        const page = yield* mcp(stack.wikiOrigin, 3, "tools/call", {
          name: "get_page",
          arguments: { url: "/deploy" },
        });
        expect(yield* toolText(page.result)).toContain("vp run infra:deploy:wiki");

        stage = "browser-telemetry";
        yield* reader.evaluate(
          'setTimeout(() => { throw new Error("E2E wiki browser exception"); }, 0); true',
        );
        yield* reader.open(stack.wikiOrigin, "/");
        yield* verifyBrowserSignals(stack.wikiOrigin, "wiki", started);
        yield* verifyExplorerBoundary(stack.wikiOrigin);
      }).pipe(staged(() => stage));
    });
  },
);
