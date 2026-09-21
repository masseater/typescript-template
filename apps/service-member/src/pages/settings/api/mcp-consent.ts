import { MEMBER_MCP_SCOPE, memberMcpToolScopes } from "@repo/config";
import { decodeJson } from "@repo/runtime/client";
import { Schema } from "effect";

const Redirect = Schema.Struct({ url: Schema.String });

const scopeLabels: Readonly<Record<(typeof memberMcpToolScopes)[number], string>> = {
  [MEMBER_MCP_SCOPE.messageSend]: "メッセージの送信",
  [MEMBER_MCP_SCOPE.profileRead]: "プロフィールの閲覧",
  [MEMBER_MCP_SCOPE.profileUpdate]: "プロフィールの更新",
  [MEMBER_MCP_SCOPE.search]: "会員の検索",
};

function scopeLabel(scope: (typeof memberMcpToolScopes)[number]): string {
  return scopeLabels[scope];
}

async function submitConsent(scopes: readonly string[]): Promise<void> {
  const response = await fetch("/api/auth/oauth2/consent", {
    body: JSON.stringify({
      accept: true,
      oauth_query: globalThis.location.search.slice(1),
      scope: scopes.join(" "),
    }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("連携の許可を処理できませんでした。");
  }
  globalThis.location.assign(decodeJson(Redirect, await response.json()).url);
}

export { scopeLabel, submitConsent };
