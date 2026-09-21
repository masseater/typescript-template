import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { ACCOUNT_STATE, APPLICATION, MEMBER_MCP_SCOPE, ROLE } from "@repo/config";
import { and, eq, query, requirePaid, schema } from "@repo/db";
import { AppOrigin, secureResponse } from "@repo/runtime/http";
import { Clock, Effect, Schema } from "effect";

import { ProfileUpdate, maximumMessageBodyLength } from "#shared/contracts/index.ts";
import { getProfile, listMembers, updateProfile } from "#shared/members/index.ts";
import { MessagingMemberRequired } from "#shared/server-api/messaging-member-required.ts";
import { openDirectConversation, sendDirectMessage } from "#shared/server-api/messaging.ts";
import { authorizeMcpRequest } from "./authorize-mcp.ts";

import type { AppServices } from "@repo/runtime";
import type { MemberMcpActor } from "./authorize-mcp.ts";

const { session, user } = schema;
const mcpVersion = "1.0.0";
const defaultPageSize = 20;

const MemberSearch = Schema.toStandardJSONSchemaV1(
  Schema.toStandardSchemaV1(
    Schema.Struct({
      keyword: Schema.optionalKey(Schema.String),
      limit: Schema.optionalKey(Schema.Int),
      offset: Schema.optionalKey(Schema.Int),
    }),
  ),
);
const ProfileInput = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(ProfileUpdate));
const MessageInput = Schema.toStandardJSONSchemaV1(
  Schema.toStandardSchemaV1(
    Schema.Struct({
      body: Schema.String.check(Schema.isLengthBetween(1, maximumMessageBodyLength)),
      conversationId: Schema.optionalKey(Schema.String),
      recipientId: Schema.optionalKey(Schema.String),
    }),
  ),
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

const failureText = (failure: { readonly _tag?: string }): string => {
  if (failure._tag === "PaidPlanRequired") {
    return "paid_plan_required";
  }
  if (failure._tag === "MessagingConversationNotFound" || failure._tag === "UserNotFound") {
    return "target_unavailable";
  }
  if (failure._tag === "MessagingMemberRequired") {
    return "member_required";
  }
  return "operation_failed";
};

const runTool =
  (runMember: <Value>(program: Effect.Effect<Value, unknown, AppServices>) => Promise<Value>) =>
  <Value>(
    program: Effect.Effect<Value, unknown, AppServices>,
  ): Promise<{ content: [{ type: "text"; text: string }]; isError?: true }> =>
    runMember(program)
      .then(toolText)
      .catch((failure: { readonly _tag?: string }) => toolFailure(failureText(failure)));

const requireMemberSession = Effect.fn("requireMemberSession")(function* requireMemberSession(
  actor: MemberMcpActor,
) {
  const now = yield* Clock.currentTimeMillis;
  const [row] = yield* query((database) =>
    database
      .select({
        accountState: user.accountState,
        audience: session.audience,
        emailVerified: user.emailVerified,
        expiresAt: session.expiresAt,
        id: user.id,
        role: user.role,
        securityVersion: user.securityVersion,
        sessionSecurityVersion: session.securityVersion,
      })
      .from(session)
      .innerJoin(user, eq(user.id, session.userId))
      .where(and(eq(session.id, actor.sessionId), eq(user.id, actor.userId)))
      .limit(1),
  );
  if (
    row === undefined ||
    row.audience !== APPLICATION.user ||
    row.expiresAt.getTime() <= now ||
    row.sessionSecurityVersion !== row.securityVersion ||
    row.role !== ROLE.member ||
    row.accountState !== ACCOUNT_STATE.active ||
    !row.emailVerified
  ) {
    return yield* new MessagingMemberRequired();
  }
  return row.id;
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
  const signedInMember = requireMemberSession(actor);

  server.registerTool(
    "get_profile",
    { description: "Read the signed-in member's own profile." },
    async () => {
      if (!actor.scopes.has(MEMBER_MCP_SCOPE.profileRead)) {
        return denied(MEMBER_MCP_SCOPE.profileRead);
      }
      return run(
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          const profile = yield* getProfile(id);
          if (profile === undefined) {
            return yield* new MessagingMemberRequired();
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
      inputSchema: ProfileInput,
    },
    async (values) => {
      if (!actor.scopes.has(MEMBER_MCP_SCOPE.profileUpdate)) {
        return denied(MEMBER_MCP_SCOPE.profileUpdate);
      }
      return run(
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          return yield* updateProfile(id, values);
        }),
      );
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
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          yield* requirePaid(id);
          return yield* listMembers(id, {
            ...(filters.keyword === undefined ? {} : { keyword: filters.keyword }),
            limit,
            offset,
          });
        }),
      );
    },
  );

  server.registerTool(
    "send_message",
    {
      description:
        "Send a direct message. Opening a new conversation requires a paid plan. Replying does not.",
      inputSchema: MessageInput,
    },
    async ({ body, conversationId, recipientId }) => {
      if (!actor.scopes.has(MEMBER_MCP_SCOPE.messageSend)) {
        return denied(MEMBER_MCP_SCOPE.messageSend);
      }
      if (conversationId !== undefined) {
        return run(
          Effect.gen(function* program() {
            const id = yield* signedInMember;
            return yield* sendDirectMessage(id, conversationId, body);
          }),
        );
      }
      if (recipientId === undefined) {
        return toolFailure("target_unavailable");
      }
      return run(
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          const sent = yield* openDirectConversation(id, recipientId, body);
          return { conversationId: sent.conversationId, id: sent.messageId };
        }),
      );
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
