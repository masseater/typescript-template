import { FLAG_KEY, FeatureFlags } from "@repo/feature-flags";
import { createApi, type ApiRoutes } from "@repo/runtime/http";
import { Effect } from "effect";

import { MemberFlags } from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";

const memberFlags = Effect.fn("memberFlags")(function* memberFlags() {
  const flags = yield* FeatureFlags;
  const memberBoard = yield* flags.getBoolean(FLAG_KEY.memberBoard);
  return { memberBoard };
});

function flagsApi<Requirements>(api: ApiRoutes<AppServices | FeatureFlags | Requirements>) {
  return createApi("").get("/flags", ...api.route({ response: MemberFlags }, memberFlags, {}));
}

export { flagsApi };
