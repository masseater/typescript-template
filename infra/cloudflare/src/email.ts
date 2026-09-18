import { RemovalPolicy, Stack } from "alchemy";
import { stackName, stackOptions } from "./stacks.ts";
import { Effect } from "effect";
import { Email } from "alchemy/Cloudflare";
import { sendingDomain } from "./config.ts";
import { settings } from "./settings.ts";

const stack = Stack(
  stackName("email"),
  stackOptions,
  Effect.gen(function* email() {
    const config = yield* Effect.orDie(settings);
    const sending = yield* Email.SendingSubdomain("Sending", {
      name: sendingDomain(config.mailFrom),
      zoneId: config.zoneId,
    }).pipe(RemovalPolicy.retain());
    return { sendingEnabled: sending.enabled, sendingName: sending.name };
  }),
);

// oxlint-disable-next-line import/no-default-export
export default stack;
