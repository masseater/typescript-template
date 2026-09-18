import { Stack } from "alchemy";
import { ApiToken } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { settings } from "./settings.ts";
import { stackName, stackOptions } from "./stacks.ts";

const accountTokens = {
  BillingRead: { permission: "Billing Read", slug: "billing-read" },
  ObservabilityQuery: { permission: "Workers Observability Write", slug: "observability-query" },
} as const satisfies Readonly<
  Record<string, { permission: ApiToken.PermissionGroupName; slug: string }>
>;

type TokenResource = keyof typeof accountTokens;

const stack = Stack(
  stackName("tokens"),
  stackOptions,
  Effect.gen(function* tokens() {
    const config = yield* Effect.orDie(settings);
    const names = yield* Effect.all(
      Object.entries(accountTokens).map(
        ([resource, { permission, slug }]: readonly [
          string,
          (typeof accountTokens)[TokenResource],
        ]) =>
          ApiToken.AccountApiToken(resource, {
            accountId: config.accountId,
            name: `${config.prefix}-${slug}`,
            policies: [
              {
                effect: "allow",
                permissionGroups: [permission],
                resources: { [`com.cloudflare.api.account.${config.accountId}`]: "*" },
              },
            ],
          }).pipe(Effect.map((token) => token.name)),
      ),
    );
    return { tokenNames: names };
  }),
);

export default stack;
const accountTokenRef = (resource: TokenResource): Effect.Effect<ApiToken.AccountApiToken> => {
  return ApiToken.AccountApiToken.ref(resource, { stack: stackName("tokens") });
};

export { accountTokenRef, accountTokens };
