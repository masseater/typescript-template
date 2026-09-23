import { MEMBER_MCP_SCOPE } from "@repo/config";
import { Button, FormColumn, STATUS_VARIANT, StatusMessage, localState, useAction } from "@repo/ui";
import { getRouteApi } from "@tanstack/react-router";

import { submitDecision } from "#pages/account/consent/api/consent.ts";
import { serviceName } from "#shared/config/index.ts";
import { McpScopeFields, requestedToolScopes, useChosenScopes } from "./mcp-scope-fields.tsx";

import type { ReactElement } from "react";
const consentRoute = getRouteApi("/consent");
const useDecided = localState(false);
function DecisionButtons({
  allowDisabled,
  denyDisabled,
  onDecide,
}: Readonly<{
  allowDisabled: boolean;
  denyDisabled: boolean;
  onDecide: (accept: boolean) => void;
}>): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={allowDisabled}
        onClick={() => {
          onDecide(true);
        }}
        type="button"
        variant="primary"
      >
        許可する
      </Button>
      <Button
        disabled={denyDisabled}
        onClick={() => {
          onDecide(false);
        }}
        type="button"
      >
        拒否する
      </Button>
    </div>
  );
}
function DecisionFailure({
  error,
}: Readonly<{ error: string | undefined }>): ReactElement | undefined {
  if (error === undefined) {
    return undefined;
  }
  return <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>;
}
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
      <DecisionButtons
        allowDisabled={disabled || selected.length === 0}
        denyDisabled={disabled}
        onDecide={decide}
      />
      <DecisionFailure error={action.error} />
    </FormColumn>
  );
}
export { ConsentActions };
