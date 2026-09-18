import { Stack } from "alchemy";
import { Zone } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { hstsSetting } from "./config.ts";
import { settings } from "./settings.ts";
import { stackName, stackOptions } from "./stacks.ts";

const stack = Stack(
  stackName("zone"),
  stackOptions,
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

// oxlint-disable-next-line import/no-default-export
export default stack;
