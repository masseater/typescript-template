import { RemovalPolicy, Stack } from "alchemy";
import { Email } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { sendingDomain } from "./config.ts";
import { settings } from "./settings.ts";
import { stackName, stackOptions } from "./stacks.ts";

const stack = Stack(
  stackName("email"),
  stackOptions,
  Effect.gen(function* email() {
    const config = yield* Effect.orDie(settings);
    yield* Email.SendingSubdomain("Sending", {
      name: sendingDomain(config.mailFrom),
      zoneId: config.zoneId,
    }).pipe(RemovalPolicy.retain());
  }),
);

export default stack;
