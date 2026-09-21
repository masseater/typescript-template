import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { APPLICATION, MEMBER_MCP_SCOPE } from "@repo/config";
import { UserNotFound } from "@repo/db";
import { AppOrigin, secureResponse } from "@repo/runtime/http";
import { Effect, Schema } from "effect";

import { ProfileUpdate, maximumMessageBodyLength } from "#shared/contracts/index.ts";
import { getProfile, searchMembers, updateProfile } from "#shared/members/index.ts";
import { authorizeMcpRequest } from "./authorize-mcp.ts";
import { openDirectConversation, sendDirectMessage } from "./messaging.ts";

import type { AppServices } from "@repo/runtime";
import type { MemberMcpActor } from "./authorize-mcp.ts";

const mcpVersion = "1.0.0";
const defaultPageSize = 20;

const MemberSearch = Schema.toStandardSchemaV1(
  Schema.Struct({
    keyword: Schema.optionalKey(Schema.String),
    limit: Schema.optionalKey(Schema.Int),
    offset: Schema.optionalKey(Schema.Int),
  }),
);

const ProfileChange = Schema.toStandardSchemaV1(ProfileUpdate);

const MessageSend = Schema.toStandardSchemaV1(
  Schema.Struct({
    body: Schema.String.check(Schema.isLengthBetween(1, maximumMessageBodyLength)),
    conversationId: Schema.optionalKey(Schema.String),
    recipientId: Schema.optionalKey(Schema.String),
  }),
);

const toolText = (value: unknown): { content: [{ type: "text"; text: string }] } => ({
  content: [{ text: JSON.stringify(value), type: "text" }],
});

const toolFailure = (
  message: string,
): { content: [{ type: "text"; text: string }]; isError: true } => ({
  content: [{ text: message, type: "text" }],
  isError: true,
});

const runTool =
  (runMember: <Value>(program: Effect.Effect<Value, unknown, AppServices>) => Promise<Value>) =>
  <Value>(
    program: Effect.Effect<Value, unknown, AppServices>,
  ): Promise<{ content: [{ type: "text"; text: string }]; isError?: true }> =>
    runMember(program)
      .then(toolText)
      .catch((failure: { readonly _tag?: string }) => {
        if (failure?._tag === "PaidPlanRequired") {
          return toolFailure("paid_plan_required");
        }
        if (failure?._tag === "MessagingMemberRequired") {
          return toolFailure("member_required");
        }
        if (failure?._tag === "MessagingConversationNotFound" || failure?._tag === "UserNotFound") {
          return toolFailure("target_unavailable");
        }
        return toolFailure("operation_failed");
      });

function denied(scope: string): { content: [{ type: "text"; text: string }]; isError: true } {
  return toolFailure(`permission_required:${scope}`);
}

function createServer(
  actor: MemberMcpActor,
  runMember: <Value>(program: Effect.Effect<Value, unknown, AppServices>) => Promise<Value>,
): McpServer {
  const server = new McpServer({ name: APPLICATION.user, version: mcpVersion });
  const run = runTool(runMember);
  const { userId } = actor;

  server.registerTool(
    "get_profile",
    { description: "Read the signed-in member's own profile." },
    async () => {
      if (!actor.scopes.has(MEMBER_MCP_SCOPE.profileRead)) {
        return denied(MEMBER_MCP_SCOPE.profileRead);
      }
      return run(
        Effect.gen(function* program() {
          const profile = yield* getProfile(userId);
          if (profile === null) {
            return yield* new UserNotFound();
          }
          return profile;
        }),
      );
    },
  );

  server.registerTool(
    "update_profile",
    {
      description: "Update the signed-in member's name, profile text, and links.",
      inputSchema: ProfileChange,
    },
    async (values) => {
      if (!actor.scopes.has(MEMBER_MCP_SCOPE.profileUpdate)) {
        return denied(MEMBER_MCP_SCOPE.profileUpdate);
      }
      return run(updateProfile(userId, values));
    },
  );

  server.registerTool(
    "search_members",
    {
      description: "List or search members who opted into search. Paid members only.",
      inputSchema: MemberSearch,
    },
    async (filters) => {
      if (!actor.scopes.has(MEMBER_MCP_SCOPE.search)) {
        return denied(MEMBER_MCP_SCOPE.search);
      }
      const limit = filters.limit ?? defaultPageSize;
      const offset = filters.offset ?? 0;
      if (limit < 1 || limit > 50 || offset < 0) {
        return toolFailure("target_unavailable");
      }
      return run(
        searchMembers(userId, {
          keyword: filters.keyword,
          limit,
          offset,
        }),
      );
    },
  );

  server.registerTool(
    "send_message",
    {
      description:
        "Send a direct message. Opening a new conversation requires a paid plan. Replying does not.",
      inputSchema: MessageSend,
    },
    async ({ body, conversationId, recipientId }) => {
      if (!actor.scopes.has(MEMBER_MCP_SCOPE.messageSend)) {
        return denied(MEMBER_MCP_SCOPE.messageSend);
      }
      if (conversationId !== undefined) {
        return run(sendDirectMessage(userId, conversationId, body));
      }
      if (recipientId === undefined) {
        return toolFailure("target_unavailable");
      }
      return run(openDirectConversation(userId, recipientId, body));
    },
  );

  return server;
}

const serveMcp = Effect.fn("serveMcp")(function* serveMcp(request: Request) {
  const origin = yield* AppOrigin;
  const authorized = yield* authorizeMcpRequest(request, origin);
  if (authorized instanceof Response) {
    return authorized;
  }
  const context = yield* Effect.context<AppServices>();
  const runMember = <Value, Failure>(
    program: Effect.Effect<Value, Failure, AppServices>,
  ): Promise<Value> => Effect.runPromise(program.pipe(Effect.provideContext(context)));
  const handler = createMcpHandler(() => createServer(authorized, runMember));
  const response = yield* Effect.promise(async () => handler.fetch(request));
  return secureResponse(request, response);
});

export { serveMcp };
