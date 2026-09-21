/** @canonical-values config.member-mcp-capability */
export const memberMcpCapabilities = [
  "member_search",
  "message_send",
  "profile_read",
  "profile_write",
] as const;
export type MemberMcpCapability = (typeof memberMcpCapabilities)[number];
export const MEMBER_MCP_CAPABILITY = {
  memberSearch: memberMcpCapabilities[0],
  messageSend: memberMcpCapabilities[1],
  profileRead: memberMcpCapabilities[2],
  profileWrite: memberMcpCapabilities[3],
} as const;
