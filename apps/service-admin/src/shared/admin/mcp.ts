import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { mailInvite } from "@repo/auth";
import { APPLICATION, ACCOUNT_STATE } from "@repo/config";
import { accountStates, adminPermissions } from "@repo/config/identity";
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
import { mcpEndpoint, toolRunner } from "@repo/runtime";
import { Effect, Schema } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

import type { AdminPermission } from "@repo/config/identity";
import type { RunApp } from "@repo/runtime";
import type { AdminMcpActor } from "./authorize-mcp.ts";

const mcpVersion = "1.0.0";
const defaultPageSize = 50;

const MemberFilters = Schema.toStandardJSONSchemaV1(
  Schema.toStandardSchemaV1(
    Schema.Struct({
      accountState: Schema.optionalKey(Schema.Literals(accountStates)),
      emailVerified: Schema.optionalKey(Schema.Boolean),
      keyword: Schema.optionalKey(Schema.String),
      limit: Schema.optionalKey(Schema.Int),
      offset: Schema.optionalKey(Schema.Int),
    }),
  ),
);

const MemberId = Schema.toStandardJSONSchemaV1(
  Schema.toStandardSchemaV1(Schema.Struct({ memberId: Schema.String })),
);

const AdminId = Schema.toStandardJSONSchemaV1(
  Schema.toStandardSchemaV1(Schema.Struct({ adminId: Schema.String })),
);

const AdminInvitation = Schema.toStandardJSONSchemaV1(
  Schema.toStandardSchemaV1(
    Schema.Struct({
      email: Schema.String,
      permission: Schema.Literals(adminPermissions),
    }),
  ),
);

const AdminPermissionChange = Schema.toStandardJSONSchemaV1(
  Schema.toStandardSchemaV1(
    Schema.Struct({
      adminId: Schema.String,
      permission: Schema.Literals(adminPermissions),
    }),
  ),
);

const failureCodes: ReadonlyMap<string, string> = new Map([
  ["InviteRejected", "invite_rejected"],
  ["LastAdminRequired", "last_admin_required"],
  ["PermissionRequired", "permission_required"],
  ["TargetUnavailable", "target_unavailable"],
]);

function createServer(actor: AdminMcpActor, runAdmin: RunApp): McpServer {
  const server = new McpServer({ name: APPLICATION.admin, version: mcpVersion });
  const { sessionId } = actor;
  const channel = AUDIT_CHANNEL.mcp;
  const run = toolRunner(runAdmin, failureCodes);

  server.registerTool(
    "search_members",
    {
      description: "Search and list service members visible to the signed-in administrator.",
      inputSchema: MemberFilters,
    },
    (filters) =>
      run(
        listUsers(sessionId, {
          ...(filters.accountState === undefined ? {} : { accountState: filters.accountState }),
          ...(filters.emailVerified === undefined ? {} : { emailVerified: filters.emailVerified }),
          ...(filters.keyword === undefined ? {} : { keyword: filters.keyword }),
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
    ({ memberId }) => run(getMember(sessionId, memberId)),
  );

  server.registerTool(
    "suspend_member",
    {
      description: "Suspend a member account. Requires operator permission or higher.",
      inputSchema: MemberId,
    },
    ({ memberId }) =>
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
    ({ memberId }) =>
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
    ({ memberId }) => run(deleteUser({ channel, sessionId, targetId: memberId })),
  );

  server.registerTool(
    "list_admins",
    {
      description: "List administrator accounts. Requires owner permission.",
    },
    () => run(listAdmins(sessionId)),
  );

  server.registerTool(
    "invite_admin",
    {
      description: "Invite a new administrator by email. Requires owner permission.",
      inputSchema: AdminInvitation,
    },
    ({ email, permission }) =>
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
    ({ adminId, permission }) =>
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
    ({ adminId }) =>
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
    ({ adminId }) =>
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

const serveMcp = mcpEndpoint(authorizeMcpRequest, (actor, runAdmin) =>
  createMcpHandler(() => createServer(actor, runAdmin)),
);

export { serveMcp };
