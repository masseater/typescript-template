import { CheckboxField } from "@repo/ui";

import { useChosenScopes } from "#pages/account/consent/model/mcp-scopes.ts";
import { scopeLabel } from "#shared/contracts/index.ts";

import type { MemberMcpToolScope } from "#pages/account/consent/model/mcp-scopes.ts";
import type { ReactElement } from "react";

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

export { McpScopeFields };
