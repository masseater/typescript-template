import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { ACCOUNT_STATE, APPLICATION, MEMBER_MCP_CAPABILITY, ROLE } from "@repo/config";
import { requirePaid, query, schema } from "@repo/db";
import { AppOrigin, secureResponse } from "@repo/runtime/http";
import { and, eq } from "drizzle-orm";
import { Clock, Effect, Schema } from "effect";

import { ConversationOpen, ProfileUpdate, memberPageSize } from "#shared/contracts/index.ts";
import { getMember, getProfile, listMembers, updateProfile } from "#shared/members/index.ts";
import { MessagingMemberRequired } from "#shared/server-api/messaging-member-required.ts";
import { openDirectConversation } from "#shared/server-api/messaging.ts";
import { authorizeMcpRequest } from "./authorize-mcp.ts";
import { requireMcpGrant } from "./grants.ts";

import type { AppServices } from "@repo/runtime";
import type { MemberMcpActor } from "./authorize-mcp.ts";

const { session, user } = schema;
const mcpVersion = "1.0.0";

const MemberId = Schema.toStandardSchemaV1(Schema.Struct({ memberId: Schema.String }));
const MemberSearch = Schema.toStandardSchemaV1(
  Schema.Struct({ keyword: Schema.optionalKey(Schema.String) }),
);
const ProfileInput = Schema.toStandardSchemaV1(ProfileUpdate);
const MessageInput = Schema.toStandardSchemaV1(ConversationOpen);

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
  if (failure._tag === "McpGrantRequired") {
    return "grant_required";
  }
  if (failure._tag === "PaidPlanRequired") {
    return "paid_required";
  }
  if (failure._tag === "MessagingConversationNotFound" || failure._tag === "UserNotFound") {
    return "not_found";
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
    async () =>
      run(
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          yield* requireMcpGrant(id, MEMBER_MCP_CAPABILITY.profileRead);
          const profile = yield* getProfile(id);
          if (profile === null) {
            return yield* new MessagingMemberRequired();
          }
          return profile;
        }),
      ),
  );

  server.registerTool(
    "update_profile",
    {
      description: "Update the signed-in member's own profile.",
      inputSchema: ProfileInput,
    },
    async (values) =>
      run(
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          yield* requireMcpGrant(id, MEMBER_MCP_CAPABILITY.profileWrite);
          return yield* updateProfile(id, values);
        }),
      ),
  );

  server.registerTool(
    "get_member",
    {
      description: "Read one member profile the signed-in member is allowed to see.",
      inputSchema: MemberId,
    },
    async ({ memberId: targetId }) =>
      run(
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          yield* requireMcpGrant(id, MEMBER_MCP_CAPABILITY.profileRead);
          return yield* getMember(id, targetId);
        }),
      ),
  );

  server.registerTool(
    "search_members",
    {
      description: "List or search members. Paid members only, and only with the search grant.",
      inputSchema: MemberSearch,
    },
    async ({ keyword }) =>
      run(
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          yield* requireMcpGrant(id, MEMBER_MCP_CAPABILITY.memberSearch);
          yield* requirePaid(id);
          return yield* listMembers({
            keyword,
            limit: memberPageSize,
            offset: 0,
          });
        }),
      ),
  );

  server.registerTool(
    "send_message",
    {
      description:
        "Send a direct message. Requires the message grant. Opening a new thread requires a paid plan.",
      inputSchema: MessageInput,
    },
    async ({ body, recipientId }) =>
      run(
        Effect.gen(function* program() {
          const id = yield* signedInMember;
          yield* requireMcpGrant(id, MEMBER_MCP_CAPABILITY.messageSend);
          const sent = yield* openDirectConversation(id, recipientId, body);
          return { conversationId: sent.conversationId, id: sent.messageId };
        }),
      ),
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
