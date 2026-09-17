import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { expect, test } from "vite-plus/test";
import { button, enrollTotp, register } from "./accounts.ts";
import { enabledButton } from "./browser.ts";
import { createStack } from "./stack.ts";
import { ensure, object, poll, string, safeFailure } from "./support.ts";
import { verifyBrowserSignals, verifyCorrelation } from "./telemetry.ts";
import { totp } from "./totp.ts";

async function mcp(
  origin: string,
  id: number,
  method: string,
  params: Record<string, unknown>,
  token: string,
) {
  const response = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
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

async function startCallbackServer() {
  const received: URL[] = [];
  const server = createServer((request, response) => {
    received.push(new URL(request.url ?? "/", "http://127.0.0.1"));
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("authorized");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  ensure(address && typeof address === "object", "E2E_CALLBACK_PORT_MISSING");
  return {
    redirectUri: `http://127.0.0.1:${address.port}/callback`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("wiki Worker: administrator login, MCP OAuth authorization, keyword search without Workers AI and correlated telemetry", async () => {
  const stack = await createStack();
  const callback = await startCallbackServer();
  let stage = "anonymous";
  try {
    const started = Math.floor(Date.now() / 1000);
    const page = await fetch(`${stack.wikiOrigin}/database`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    ensure(
      page.status === 302 && page.headers.get("location") === "/login",
      "E2E_WIKI_PAGE_READABLE_WITHOUT_LOGIN",
    );
    const anonymousSearch = await fetch(`${stack.wikiOrigin}/api/search?query=wiki`, {
      signal: AbortSignal.timeout(5000),
    });
    ensure(anonymousSearch.status === 401, "E2E_WIKI_SEARCH_READABLE_WITHOUT_LOGIN");
    const anonymousMcp = await fetch(`${stack.wikiOrigin}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      signal: AbortSignal.timeout(5000),
    });
    const resourceMetadata = `${stack.wikiOrigin}/.well-known/oauth-protected-resource/mcp`;
    ensure(
      anonymousMcp.status === 401 &&
        (anonymousMcp.headers.get("www-authenticate") ?? "").includes(
          `resource_metadata="${resourceMetadata}"`,
        ),
      "E2E_WIKI_MCP_CHALLENGE_MISSING",
    );
    const metadata = object(
      await (await fetch(resourceMetadata, { signal: AbortSignal.timeout(5000) })).json(),
    );
    ensure(metadata["resource"] === `${stack.wikiOrigin}/mcp`, "E2E_WIKI_RESOURCE_METADATA_WRONG");

    stage = "administrator";
    const reader = stack.account("wiki-reader");
    const enrollment = stack.browser("wiki-enrollment");
    await register(stack, enrollment, reader);
    const { uri } = await enrollTotp(enrollment, stack.userOrigin, reader.password);
    await stack.bootstrap(reader.email);

    stage = "client-registration";
    const registration = await fetch(`${stack.wikiOrigin}/api/auth/oauth2/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "E2E MCP client",
        redirect_uris: [callback.redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
      signal: AbortSignal.timeout(5000),
    });
    ensure(registration.status === 201, "E2E_WIKI_CLIENT_REGISTRATION_FAILED");
    const clientId = string(object(await registration.json())["client_id"]);
    const verifier = randomBytes(32).toString("base64url");
    const authorize = new URL("/api/auth/oauth2/authorize", stack.wikiOrigin);
    for (const [key, value] of Object.entries({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callback.redirectUri,
      scope: "wiki:read offline_access",
      state: "e2e-state",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      resource: `${stack.wikiOrigin}/mcp`,
    }))
      authorize.searchParams.set(key, value);

    stage = "login";
    const browser = stack.browser("wiki-reader");
    await browser.commands(["open", authorize.href]);
    await browser.commands(
      ["wait", 'input[name="email"]'],
      enabledButton("ログイン"),
      ["fill", 'input[name="email"]', reader.email],
      ["fill", 'input[name="password"]', reader.password],
    );
    await browser.submitAuthentication("/api/auth/sign-in/email", [button("ログイン")]);
    await browser.commands(
      ["wait", 'input[name="totp"]'],
      ["fill", 'input[name="totp"]', totp(uri)],
    );
    await browser.submitAuthentication("/api/auth/two-factor/verify-totp", [
      button("確認コードでログイン"),
    ]);

    stage = "consent";
    await browser.waitText("E2E MCP client に Wiki の閲覧を許可しますか？");
    await browser.commands(enabledButton("許可する"), button("許可する"));
    const redirected = await poll(
      async () => callback.received.find((url) => url.pathname === "/callback"),
      (url) => url !== undefined,
      "E2E_WIKI_AUTHORIZATION_REDIRECT_MISSING",
    );
    ensure(redirected?.searchParams.get("state") === "e2e-state", "E2E_WIKI_STATE_MISMATCH");
    const code = string(redirected.searchParams.get("code"));
    const exchanged = await fetch(`${stack.wikiOrigin}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: clientId,
        redirect_uri: callback.redirectUri,
        resource: `${stack.wikiOrigin}/mcp`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    ensure(exchanged.ok, "E2E_WIKI_TOKEN_EXCHANGE_FAILED");
    const token = string(object(await exchanged.json())["access_token"]);

    stage = "pages";
    await browser.open(stack.wikiOrigin, "/");
    await browser.waitText("この wiki は");
    await browser.open(stack.wikiOrigin, "/database");
    await browser.waitText("適用済みのマイグレーションファイルは書き換えません。");

    stage = "application-isolation";
    for (const pathname of ["/api/users", "/api/profile"]) {
      const response = await browser.api(pathname);
      ensure(response.status === 404, "E2E_APPLICATION_ROUTE_EXPOSED_BY_WIKI");
    }

    stage = "search";
    const search = await browser.api(
      `/api/search?${new URLSearchParams({ query: "パスキー" }).toString()}`,
    );
    ensure(search.status === 200 && Array.isArray(search.data), "E2E_WIKI_SEARCH_FAILED");
    ensure(object(search.data[0])["url"] === "/authentication", "E2E_WIKI_KEYWORD_RANKING_WRONG");
    await verifyCorrelation(search, "wiki", [reader.password, token]);
    await browser.commands(
      ["find", "role", "button", "click", "--name", "検索 ⌘ K", "--exact"],
      ["wait", 'input[placeholder="検索"]'],
      ["fill", 'input[placeholder="検索"]', "マイグレーション"],
      ["wait", "--text", "差分から SQL を生成します。"],
    );

    stage = "mcp";
    const tools = await mcp(stack.wikiOrigin, 1, "tools/list", {}, token);
    const names = tools.result["tools"];
    ensure(Array.isArray(names), "E2E_WIKI_MCP_TOOLS_MISSING");
    const toolNames = names.map((tool: unknown) => string(object(tool)["name"])).sort();
    ensure(toolNames.join(",") === "get_page,list_pages,search", "E2E_WIKI_MCP_TOOLS_UNEXPECTED");
    const found = await mcp(
      stack.wikiOrigin,
      2,
      "tools/call",
      { name: "search", arguments: { query: "Cloudflare R2" } },
      token,
    );
    const results: unknown = JSON.parse(toolText(found.result));
    ensure(
      Array.isArray(results) && object(results[0])["url"] === "/deploy",
      "E2E_WIKI_MCP_KEYWORD_RANKING_WRONG",
    );
    await verifyCorrelation(found, "wiki", [reader.password, token]);
    const loaded = await mcp(
      stack.wikiOrigin,
      3,
      "tools/call",
      { name: "get_page", arguments: { url: "/deploy" } },
      token,
    );
    expect(toolText(loaded.result)).toContain("vp run infra:deploy:wiki");

    stage = "browser-telemetry";
    await browser.evaluate(
      'setTimeout(() => { throw new Error("E2E wiki browser exception"); }, 0); true',
    );
    await browser.open(stack.wikiOrigin, "/");
    await verifyBrowserSignals("wiki", started);
  } catch (error) {
    throw safeFailure(error, stage);
  } finally {
    await callback.close();
    await stack.cleanup();
  }
});
