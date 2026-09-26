import { RemovalPolicy, renamedFrom } from "alchemy";
import { Email } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { sendingDomain } from "./config.ts";
import { prefixedStack } from "./prefixed-stack.ts";
import { settings } from "./settings.ts";

function alertAddressResource(recipient: string): string {
  const escaped = recipient
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/gu, (character) => `_${(character.codePointAt(0) ?? 0).toString(16)}_`);
  return `Alert-${escaped}`;
}

const stack = prefixedStack(
  "email",
  Effect.gen(function* email() {
    const config = yield* Effect.orDie(settings);
    yield* Email.SendingSubdomain("Sending", {
      name: sendingDomain(config.mailFrom),
      zoneId: config.zoneId,
    }).pipe(RemovalPolicy.retain());
    yield* Effect.forEach(config.budget.recipients, (recipient, index) =>
      Email.Address(alertAddressResource(recipient), { email: recipient }).pipe(
        renamedFrom(`Alert${index + 1}`),
        RemovalPolicy.retain(),
      ),
    );
  }),
);

export default stack;
export { alertAddressResource };
