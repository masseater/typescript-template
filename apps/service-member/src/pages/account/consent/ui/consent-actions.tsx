import { MEMBER_MCP_SCOPE } from "@repo/config";
import { Button, FormColumn, STATUS_VARIANT, StatusMessage, localState, useAction } from "@repo/ui";
import { getRouteApi } from "@tanstack/react-router";

import { submitDecision } from "#pages/account/consent/api/consent.ts";
import { serviceName } from "#shared/config/index.ts";
import { McpScopeFields, requestedToolScopes, useChosenScopes } from "./mcp-scope-fields.tsx";

import type { ReactElement } from "react";
const consentRoute = getRouteApi("/consent");
const useDecided = localState(false);
function ConsentActions({
  client,
}: Readonly<{
  client: string;
}>): ReactElement {
  const search = consentRoute.useSearch();
  const requested = requestedToolScopes(search.scope);
  const [chosen] = useChosenScopes();
  const action = useAction();
  const [decided, setDecided] = useDecided();
  const selected = chosen ?? requested;
  function decide(accept: boolean): void {
    const scopes =
      accept && search.scope?.split(" ").includes(MEMBER_MCP_SCOPE.offlineAccess)
        ? [...selected, MEMBER_MCP_SCOPE.offlineAccess]
        : selected;
    action.run(() => submitDecision(accept, scopes).then(() => setDecided(true)));
  }
  const disabled = action.blocked || decided;
  return (
    <FormColumn>
      <p>
        {client} に {serviceName} で許す操作を選んでください。選んでいない操作は拒否されます。
      </p>
      <McpScopeFields requested={requested} />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled || selected.length === 0}
          onClick={() => {
            decide(true);
          }}
          type="button"
          variant="primary"
        >
          許可する
        </Button>
        <Button
          disabled={disabled}
          onClick={() => {
            decide(false);
          }}
          type="button"
        >
          拒否する
        </Button>
      </div>
      {action.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{action.error}</StatusMessage>
      )}
    </FormColumn>
  );
}
export { ConsentActions };
