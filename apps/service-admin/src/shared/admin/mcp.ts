import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { mailInvite } from "@repo/auth";
import { APPLICATION, ACCOUNT_STATE } from "@repo/config";
import { ADMIN_PERMISSION, accountStates, adminPermissions } from "@repo/config/identity";
import { AUDIT_CHANNEL } from "@repo/db";
import {
  deleteUser,
  getMember,
  inviteAdmin,
  listAdmins,
  listUsers,
  setAdminPermission,
  setAdminState,
  setMemberState,
} from "@repo/db/admin";
import { AppOrigin, secureResponse } from "@repo/runtime/http";
import { Effect, Schema } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

import type { AdminPermission } from "@repo/config/identity";
import type { AppServices } from "@repo/runtime";
import type { AdminMcpActor } from "./authorize-mcp.ts";

const mcpVersion = "1.0.0";
const defaultPageSize = 50;

const MemberFilters = Schema.toStandardSchemaV1(
  Schema.Struct({
    accountState: Schema.optionalKey(Schema.Literals(accountStates)),
    emailVerified: Schema.optionalKey(Schema.Boolean),
    keyword: Schema.optionalKey(Schema.String),
    limit: Schema.optionalKey(Schema.Int),
    offset: Schema.optionalKey(Schema.Int),
  }),
);

const MemberId = Schema.toStandardSchemaV1(Schema.Struct({ memberId: Schema.String }));

const AdminId = Schema.toStandardSchemaV1(Schema.Struct({ adminId: Schema.String }));

const AdminInvitation = Schema.toStandardSchemaV1(
  Schema.Struct({
    email: Schema.String,
    permission: Schema.Literals(adminPermissions),
  }),
);

const AdminPermissionChange = Schema.toStandardSchemaV1(
  Schema.Struct({
    adminId: Schema.String,
    permission: Schema.Literals(adminPermissions),
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
  (runAdmin: <Value>(program: Effect.Effect<Value, unknown, AppServices>) => Promise<Value>) =>
  <Value>(
    program: Effect.Effect<Value, unknown, AppServices>,
  ): Promise<{ content: [{ type: "text"; text: string }]; isError?: true }> =>
    runAdmin(program)
      .then(toolText)
      .catch((failure: { readonly _tag?: string }) => {
        if (failure?._tag === "PermissionRequired") {
          return toolFailure("permission_required");
        }
        if (failure?._tag === "TargetUnavailable") {
          return toolFailure("target_unavailable");
        }
        if (failure?._tag === "LastAdminRequired") {
          return toolFailure("last_admin_required");
        }
        if (failure?._tag === "InviteRejected") {
          return toolFailure("invite_rejected");
        }
        return toolFailure("operation_failed");
      });

function createServer(
  actor: AdminMcpActor,
  runAdmin: <Value>(program: Effect.Effect<Value, unknown, AppServices>) => Promise<Value>,
): McpServer {
  const server = new McpServer({ name: APPLICATION.admin, version: mcpVersion });
  const { sessionId } = actor;
  const channel = AUDIT_CHANNEL.mcp;
  const run = runTool(runAdmin);

  server.registerTool(
    "search_members",
    {
      description: "Search and list service members visible to the signed-in administrator.",
      inputSchema: MemberFilters,
    },
    async (filters) =>
      run(
        listUsers(sessionId, {
          accountState: filters.accountState,
          emailVerified: filters.emailVerified,
          keyword: filters.keyword,
          limit: filters.limit ?? defaultPageSize,
          offset: filters.offset ?? 0,
        }),
      ),
  );

  server.registerTool(
    "get_member",
    {
      description: "Load one member record when the administrator may view that member.",
      inputSchema: MemberId,
    },
    async ({ memberId }) => run(getMember(sessionId, memberId)),
  );

  server.registerTool(
    "suspend_member",
    {
      description: "Suspend a member account. Requires operator permission or higher.",
      inputSchema: MemberId,
    },
    async ({ memberId }) =>
      run(
        setMemberState({
          accountState: ACCOUNT_STATE.suspended,
          channel,
          memberId,
          sessionId,
        }),
      ),
  );

  server.registerTool(
    "unsuspend_member",
    {
      description: "Restore a suspended member account. Requires operator permission or higher.",
      inputSchema: MemberId,
    },
    async ({ memberId }) =>
      run(
        setMemberState({
          accountState: ACCOUNT_STATE.active,
          channel,
          memberId,
          sessionId,
        }),
      ),
  );

  server.registerTool(
    "delete_member",
    {
      description: "Permanently delete a member account. Requires operator permission or higher.",
      inputSchema: MemberId,
    },
    async ({ memberId }) => run(deleteUser(sessionId, memberId, channel)),
  );

  server.registerTool(
    "list_admins",
    {
      description: "List administrator accounts. Requires owner permission.",
    },
    async () => run(listAdmins(sessionId)),
  );

  server.registerTool(
    "invite_admin",
    {
      description: "Invite a new administrator by email. Requires owner permission.",
      inputSchema: AdminInvitation,
    },
    async ({ email, permission }) =>
      run(
        inviteAdmin({ channel, email, permission: permission as AdminPermission, sessionId }).pipe(
          Effect.flatMap((issued) =>
            mailInvite(issued).pipe(
              Effect.as({ email: issued.email, expiresAt: issued.expiresAt }),
            ),
          ),
        ),
      ),
  );

  server.registerTool(
    "change_admin_permission",
    {
      description: "Change another administrator's permission tier. Requires owner permission.",
      inputSchema: AdminPermissionChange,
    },
    async ({ adminId, permission }) =>
      run(
        setAdminPermission({
          adminId,
          channel,
          permission: permission as AdminPermission,
          sessionId,
        }),
      ),
  );

  server.registerTool(
    "disable_admin",
    {
      description: "Disable another administrator account. Requires owner permission.",
      inputSchema: AdminId,
    },
    async ({ adminId }) =>
      run(
        setAdminState({
          accountState: ACCOUNT_STATE.suspended,
          adminId,
          channel,
          sessionId,
        }),
      ),
  );

  server.registerTool(
    "enable_admin",
    {
      description: "Re-enable a disabled administrator account. Requires owner permission.",
      inputSchema: AdminId,
    },
    async ({ adminId }) =>
      run(
        setAdminState({
          accountState: ACCOUNT_STATE.active,
          adminId,
          channel,
          sessionId,
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
  const runAdmin = <Value, Failure>(
    program: Effect.Effect<Value, Failure, AppServices>,
  ): Promise<Value> => Effect.runPromise(program.pipe(Effect.provideContext(context)));
  const handler = createMcpHandler(() => createServer(authorized, runAdmin));
  const response = yield* Effect.promise(async () => handler.fetch(request));
  return secureResponse(request, response);
});

export { serveMcp };
