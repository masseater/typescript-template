import { RemovalPolicy } from "alchemy";
import { Email } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { sendingDomain } from "./config.ts";
import { prefixedStack } from "./prefixed-stack.ts";
import { settings } from "./settings.ts";

const stack = prefixedStack(
  "email",
  Effect.gen(function* email() {
    const config = yield* Effect.orDie(settings);
    yield* Email.SendingSubdomain("Sending", {
      name: sendingDomain(config.mailFrom),
      zoneId: config.zoneId,
    }).pipe(RemovalPolicy.retain());
    yield* Effect.forEach(config.budget.recipients, (recipient, index) =>
      Email.Address(`Alert${index + 1}`, { email: recipient }).pipe(RemovalPolicy.retain()),
    );
  }),
);

export default stack;
