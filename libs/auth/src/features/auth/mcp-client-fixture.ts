import { Data, Effect, Schema } from "effect";

type FetchMcp = (outgoing: Request) => Effect.Effect<Response>;
type McpCall = Readonly<{ fetchMcp: FetchMcp; origin: string; token: string }>;

class McpResponseMissingData extends Data.TaggedError("McpResponseMissingData") {}

const McpJson = Schema.fromJsonString(Schema.Unknown);
const McpTokens = Schema.Struct({ access_token: Schema.String });
const decodeOAuthRedirect = Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }));

const responseStatus = (candidate: unknown): number | undefined =>
  candidate instanceof Response ? candidate.status : undefined;

const sendMcp = Effect.fn("sendMcp")(function* sendMcp(call: McpCall, rpcEnvelope?: unknown) {
  const encoded =
    rpcEnvelope === undefined ? undefined : yield* Schema.encodeEffect(McpJson)(rpcEnvelope);
  const outgoing = new Request(`${call.origin}/mcp`, {
    ...(encoded === undefined ? {} : { body: encoded }),
    headers: {
      accept: "application/json, text/event-stream",
      ...(encoded === undefined ? {} : { "content-type": "application/json" }),
      authorization: `Bearer ${call.token}`,
    },
    method: "POST",
  });
  return yield* call.fetchMcp(outgoing);
});

const parseMcpBody = Effect.fn("parseMcpBody")(function* parseMcpBody(mcpReply: Response) {
  const contentType = mcpReply.headers.get("content-type") ?? "";
  const replyText = yield* Effect.promise(() => mcpReply.text());
  if (contentType.includes("application/json")) {
    return yield* Schema.decodeEffect(McpJson)(replyText);
  }
  const dataLine = replyText.split("\n").find((line) => line.startsWith("data: "));
  if (dataLine === undefined) {
    return yield* new McpResponseMissingData();
  }
  return yield* Schema.decodeEffect(McpJson)(dataLine.slice("data: ".length));
});

const callMcpTool = Effect.fn("callMcpTool")(function* callMcpTool(
  call: McpCall,
  tool: Readonly<{ arguments: Readonly<Record<string, unknown>>; name: string }>,
) {
  const mcpReply = yield* sendMcp(call, {
    id: 1,
    jsonrpc: "2.0",
    method: "tools/call",
    params: tool,
  });
  return yield* parseMcpBody(mcpReply);
});

export { McpJson, McpTokens, callMcpTool, decodeOAuthRedirect, responseStatus, sendMcp };
export type { FetchMcp };
