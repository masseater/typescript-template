import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { selectAccountPermission } from "./config.ts";
import { consumeSettings } from "./reference.ts";

const { settings } = await consumeSettings("tokens", "settings");
const permissions = cloudflare.getAccountApiTokenPermissionGroupsListOutput({
  accountId: settings.accountId,
});

function accountToken(name: string, permission: Parameters<typeof selectAccountPermission>[1]) {
  const token = new cloudflare.AccountToken(
    name,
    {
      accountId: settings.accountId,
      name: `${settings.prefix}-${name}`,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            {
              id: permissions.results.apply((groups) =>
                selectAccountPermission(groups, permission),
              ),
            },
          ],
          resources: JSON.stringify({ [`com.cloudflare.api.account.${settings.accountId}`]: "*" }),
        },
      ],
    },
    { additionalSecretOutputs: ["value"] },
  );
  return pulumi.secret(token.value);
}

export const billingReadToken = accountToken("billing-read", "Billing Read");
export const observabilityQueryToken = accountToken(
  "observability-query",
  "Workers Observability Write",
);
