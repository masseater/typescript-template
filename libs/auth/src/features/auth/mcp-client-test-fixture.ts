import { Data, Effect, Schema } from "effect";

import { AuthApps } from "./auth-test-fixture.ts";
import { Auth } from "./auth.ts";
import { origins } from "./browser-client-test-fixture.ts";

import type { Application } from "@repo/config";

type FetchMcp = (request: Request) => Effect.Effect<Response>;

class McpResponseMissingData extends Data.TaggedError("McpResponseMissingData")<{}> {}

const JsonUnknown = Schema.fromJsonString(Schema.Unknown);
const dataPrefix = "data: ";

function responseStatus(value: unknown): number | undefined {
  return value instanceof Response ? value.status : undefined;
}

function bearerHeaders(token: string | undefined): Readonly<Record<string, string>> {
  return token === undefined ? {} : { authorization: `Bearer ${token}` };
}

function authorizeMcpAs<Value, Failure, Requirements>(
  application: Application,
  authorize: (request: Request, origin: string) => Effect.Effect<Value, Failure, Requirements>,
  token?: string,
): Effect.Effect<Value, Failure, Exclude<Requirements, Auth> | AuthApps> {
  const origin = origins[application];
  const incoming = new Request(`${origin}/mcp`, { headers: bearerHeaders(token), method: "POST" });
  return Effect.gen(function* authorizeAs() {
    const auth = (yield* AuthApps)[application];
    return yield* authorize(incoming, origin).pipe(Effect.provideService(Auth, auth));
  });
}

const parseMcpBody = Effect.fn("parseMcpBody")(function* parseMcpBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = yield* Effect.promise(() => response.text());
  if (contentType.includes("application/json")) {
    return yield* Schema.decodeEffect(JsonUnknown)(text);
  }
  const dataLine = text.split("\n").find((line) => line.startsWith(dataPrefix));
  if (dataLine === undefined) {
    return yield* new McpResponseMissingData();
  }
  return yield* Schema.decodeEffect(JsonUnknown)(dataLine.slice(dataPrefix.length));
});

function mcpClient(origin: string, fetchMcp: FetchMcp) {
  const post = Effect.fn("postMcp")(function* postMcp(token: string, body?: unknown) {
    const encoded = body === undefined ? undefined : yield* Schema.encodeEffect(JsonUnknown)(body);
    const incoming = new Request(`${origin}/mcp`, {
      ...(encoded === undefined ? {} : { body: encoded }),
      headers: {
        accept: "application/json, text/event-stream",
        ...(encoded === undefined ? {} : { "content-type": "application/json" }),
        ...bearerHeaders(token),
      },
      method: "POST",
    });
    return yield* fetchMcp(incoming);
  });
  const callTool = Effect.fn("callTool")(function* callTool(
    token: string,
    name: string,
    args: Readonly<Record<string, unknown>> = {},
  ) {
    const response = yield* post(token, {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: args, name },
    });
    return yield* parseMcpBody(response);
  });
  return { callTool, post };
}

type McpClient = ReturnType<typeof mcpClient>;

export { authorizeMcpAs, mcpClient, responseStatus };
export type { FetchMcp, McpClient };
