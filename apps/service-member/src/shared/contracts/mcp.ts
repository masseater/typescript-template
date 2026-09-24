import { MEMBER_MCP_SCOPE, memberMcpToolScopes } from "@repo/config";

const scopeLabels = {
  [MEMBER_MCP_SCOPE.messageSend]: "メッセージの送信",
  [MEMBER_MCP_SCOPE.profileRead]: "プロフィールの閲覧",
  [MEMBER_MCP_SCOPE.profileUpdate]: "プロフィールの更新",
  [MEMBER_MCP_SCOPE.search]: "会員の検索",
} as const satisfies Readonly<Record<(typeof memberMcpToolScopes)[number], string>>;

function scopeLabel(scope: (typeof memberMcpToolScopes)[number]): string {
  return scopeLabels[scope];
}

export { scopeLabel };
