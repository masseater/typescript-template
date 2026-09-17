import { AccountToken, getAccountApiTokenPermissionGroupsListOutput } from "@pulumi/cloudflare";
import type { AccountPermission } from "./config.ts";
import type { Output } from "@pulumi/pulumi";
import { consumeSettings } from "./reference.ts";
import { secret } from "@pulumi/pulumi";
import { selectAccountPermission } from "./config.ts";

type PermissionGroups = readonly Readonly<{
  id: string;
  name: string;
  scopes: readonly string[];
}>[];

const { settings } = await consumeSettings("tokens", "settings");
const permissions = getAccountApiTokenPermissionGroupsListOutput({
  accountId: settings.accountId,
});

function accountToken(name: string, permission: AccountPermission): Output<string> {
  const permissionId = permissions.results.apply((groups: PermissionGroups) =>
    selectAccountPermission(groups, permission),
  );
  const token = new AccountToken(
    name,
    {
      accountId: settings.accountId,
      name: `${settings.prefix}-${name}`,
      policies: [
        {
          effect: "allow",
          permissionGroups: [{ id: permissionId }],
          resources: JSON.stringify({ [`com.cloudflare.api.account.${settings.accountId}`]: "*" }),
        },
      ],
    },
    { additionalSecretOutputs: ["value"] },
  );
  return secret(token.value);
}

const billingReadToken = accountToken("billing-read", "Billing Read");
const observabilityQueryToken = accountToken("observability-query", "Workers Observability Write");

export { billingReadToken, observabilityQueryToken };
