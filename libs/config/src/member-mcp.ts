/** @canonical-values config.member-mcp-capability */
export const memberMcpCapabilities = [
  "member_search",
  "message_send",
  "profile_read",
  "profile_write",
] as const;
const memberMcpScopes = [
  "member:profile:read",
  "member:profile:update",
  "member:search",
  "member:message:send",
  "offline_access",
] as const;

type MemberMcpScope = (typeof memberMcpScopes)[number];

const MEMBER_MCP_SCOPE = {
  messageSend: memberMcpScopes[3],
  offlineAccess: memberMcpScopes[4],
  profileRead: memberMcpScopes[0],
  profileUpdate: memberMcpScopes[1],
  search: memberMcpScopes[2],
} as const;

const memberMcpToolScopes = [
  MEMBER_MCP_SCOPE.profileRead,
  MEMBER_MCP_SCOPE.profileUpdate,
  MEMBER_MCP_SCOPE.search,
  MEMBER_MCP_SCOPE.messageSend,
] as const;

export { MEMBER_MCP_SCOPE, memberMcpScopes, memberMcpToolScopes };
export type { MemberMcpScope };
