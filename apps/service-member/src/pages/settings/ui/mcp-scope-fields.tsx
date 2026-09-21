import { memberMcpToolScopes } from "@repo/config";
import { CheckboxField, localState } from "@repo/ui";

import { scopeLabel } from "#pages/settings/api/mcp-consent.ts";

import type { ReactElement } from "react";

type MemberMcpToolScope = (typeof memberMcpToolScopes)[number];

const useChosenScopes = localState<readonly MemberMcpToolScope[] | undefined>(undefined);

function isToolScope(value: string): value is MemberMcpToolScope {
  return memberMcpToolScopes.some((scope) => scope === value);
}

function requestedToolScopes(scope: string | undefined): readonly MemberMcpToolScope[] {
  return (scope ?? "").split(" ").filter(isToolScope);
}

function McpScopeFields({
  requested,
}: Readonly<{ requested: readonly MemberMcpToolScope[] }>): ReactElement {
  const [chosen, setChosen] = useChosenScopes();
  const selected = chosen ?? requested;
  const selectedSet = new Set(selected);
  function toggle(scope: MemberMcpToolScope, checked: boolean): void {
    const current = chosen ?? requested;
    setChosen(checked ? [...current, scope] : current.filter((item) => item !== scope));
  }
  return (
    <div className="flex flex-col gap-2">
      {requested.map((scope) => (
        <CheckboxField
          key={scope}
          checked={selectedSet.has(scope)}
          label={scopeLabel(scope)}
          onCheckedChange={(checked) => {
            toggle(scope, checked);
          }}
        />
      ))}
    </div>
  );
}

export { McpScopeFields, requestedToolScopes, useChosenScopes };
