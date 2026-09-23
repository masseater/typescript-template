import { verifySession } from "@repo/auth";
import { ConfigurationInvalid, httpStatus } from "@repo/config";
import { FeatureFlags, requireFlagEditor, toggleFlag, toggleFlagRemote } from "@repo/feature-flags";
import { createApi, readJsonBody, type ApiRoutes } from "@repo/runtime/http";
import { env } from "cloudflare:workers";
import { Effect, Redacted } from "effect";

import { FlagList, FlagToggle, FlagToggled } from "#shared/contracts/index.ts";
import { readWikiConfig } from "#shared/wiki/wiki-config.ts";

import type { WikiServices } from "#shared/wiki/index.ts";

const failures = {
  ConfigurationInvalid: "unexpected",
  DatabaseFailure: "unexpected",
  FlagEditorRequired: {
    message: "機能フラグの変更権限がありません。",
    status: httpStatus.forbidden,
  },
  FlagshipWriteFailed: "unexpected",
} as const;

const listFlags = Effect.fn("listFlags")(function* listFlags(request: Request) {
  yield* verifySession(request.headers);
  const flags = yield* FeatureFlags;
  const entries = yield* flags.list;
  return { flags: entries };
});

const flagshipCredentials = (config: {
  readonly FLAGSHIP_ACCOUNT_ID?: string | undefined;
  readonly FLAGSHIP_API_TOKEN?: string | undefined;
  readonly FLAGSHIP_APP_ID?: string | undefined;
}): Parameters<typeof toggleFlagRemote>[0] | undefined =>
  config.FLAGSHIP_API_TOKEN === undefined ||
  config.FLAGSHIP_APP_ID === undefined ||
  config.FLAGSHIP_ACCOUNT_ID === undefined
    ? undefined
    : {
        accountId: config.FLAGSHIP_ACCOUNT_ID,
        appId: config.FLAGSHIP_APP_ID,
        authToken: Redacted.make(config.FLAGSHIP_API_TOKEN),
      };

const patchFlag = Effect.fn("patchFlag")(function* patchFlag(request: Request) {
  const { user } = yield* requireFlagEditor(request.headers);
  const change = yield* readJsonBody(FlagToggle, request);
  const config = yield* readWikiConfig(env);
  const toggle = { actorId: user.id, enabled: change.enabled, key: change.key };
  const credentials = flagshipCredentials(config);
  if (credentials !== undefined) {
    return yield* toggleFlagRemote(credentials, toggle);
  }
  if (config.local) {
    return yield* toggleFlag(toggle);
  }
  return yield* new ConfigurationInvalid({ reason: "FLAGSHIP write credentials" });
});

function flagsApi<Requirements>(api: ApiRoutes<WikiServices | Requirements>) {
  return createApi("")
    .get("/flags", api.route(FlagList, listFlags, { DatabaseFailure: "unexpected" }))
    .patch("/flags", api.route(FlagToggled, patchFlag, failures));
}

export { flagsApi };
