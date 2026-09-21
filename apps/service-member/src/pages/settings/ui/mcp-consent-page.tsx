import { MEMBER_MCP_SCOPE } from "@repo/config";
import { Button, FormColumn, Page, STATUS_VARIANT, StatusMessage, useAction } from "@repo/ui";
import { getRouteApi } from "@tanstack/react-router";

import { submitConsent } from "#pages/settings/api/mcp-consent.ts";
import { McpScopeFields, requestedToolScopes, useChosenScopes } from "./mcp-scope-fields.tsx";

import type { ReactElement } from "react";

const consentRoute = getRouteApi("/consent");

function McpConsentPage(): ReactElement {
  const search = consentRoute.useSearch();
  const requested = requestedToolScopes(search.scope);
  const [chosen] = useChosenScopes();
  const action = useAction();
  const selected = chosen ?? requested;
  function allow(): void {
    const scopes = search.scope?.split(" ").includes(MEMBER_MCP_SCOPE.offlineAccess)
      ? [...selected, MEMBER_MCP_SCOPE.offlineAccess]
      : selected;
    action.run(async () => {
      await submitConsent(scopes);
    });
  }
  return (
    <Page title="AI との連携">
      {search.client_id === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          連携を求めているクライアントが分かりません。
        </StatusMessage>
      ) : (
        <FormColumn>
          <p className="text-base leading-normal">
            {search.client_id} に許す操作を選んでください。選んでいない操作は拒否されます。
          </p>
          <McpScopeFields requested={requested} />
          <Button
            disabled={action.blocked || selected.length === 0}
            onClick={allow}
            type="button"
            variant="primary"
          >
            許可する
          </Button>
          {action.error !== undefined && (
            <StatusMessage variant={STATUS_VARIANT.failure}>{action.error}</StatusMessage>
          )}
        </FormColumn>
      )}
    </Page>
  );
}

export { McpConsentPage };
