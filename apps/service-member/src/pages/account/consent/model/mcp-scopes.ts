import { memberMcpToolScopes } from "@repo/config";
import { localState } from "@repo/ui";

type MemberMcpToolScope = (typeof memberMcpToolScopes)[number];

const useChosenScopes = localState<readonly MemberMcpToolScope[] | undefined>(undefined);

function isToolScope(value: string): value is MemberMcpToolScope {
  return memberMcpToolScopes.some((scope) => scope === value);
}

function requestedToolScopes(scope: string | undefined): readonly MemberMcpToolScope[] {
  return (scope ?? "").split(" ").filter(isToolScope);
}

export { requestedToolScopes, useChosenScopes };
export type { MemberMcpToolScope };
