import { Zone } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { hstsSetting } from "./config.ts";
import { prefixedStack } from "./prefixed-stack.ts";
import { settings } from "./settings.ts";

const stack = prefixedStack(
  "zone",
  Effect.gen(function* zone() {
    const config = yield* Effect.orDie(settings);
    yield* Zone.Setting("AlwaysUseHttps", {
      settingId: "always_use_https",
      value: "on",
      zoneId: config.zoneId,
    });
    yield* Zone.Setting("SecurityHeader", {
      settingId: "security_header",
      value: hstsSetting,
      zoneId: config.zoneId,
    });
  }),
);

export default stack;
