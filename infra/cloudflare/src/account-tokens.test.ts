import { it } from "@effect/vitest";
import { ApiToken } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { accountTokens } from "./account-tokens.ts";

it.effect("resolves every issued account token permission through Alchemy", () =>
  Effect.sync(() => {
    for (const { permission } of Object.values(accountTokens)) {
      ApiToken.resolvePermissionGroup(permission);
    }
  }),
);
