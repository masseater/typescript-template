import { AccountToken, getAccountApiTokenPermissionGroupsListOutput } from "@pulumi/cloudflare";
import { Effect } from "effect";
import type { Output } from "@pulumi/pulumi";
import { consumeSettings } from "./reference.ts";
import { secret } from "@pulumi/pulumi";
import { selectAccountPermission } from "./config.ts";

const { settings } = await Effect.runPromise(consumeSettings("tokens", "settings"));
const permissions = getAccountApiTokenPermissionGroupsListOutput({
  accountId: settings.accountId,
});

function accountToken(
  name: string,
  permission: Parameters<typeof selectAccountPermission>[1],
): Output<string> {
  const token = new AccountToken(
    name,
    {
      accountId: settings.accountId,
      name: `${settings.prefix}-${name}`,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            {
              // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
              id: permissions.results.apply(async (groups) =>
                Effect.runPromise(selectAccountPermission(groups, permission)),
              ),
            },
          ],
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
