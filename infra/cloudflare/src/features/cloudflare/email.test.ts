import { assert, it } from "@effect/vitest";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Effect } from "effect";
import { ConfigProvider, fromEnv } from "effect/ConfigProvider";

import { applyVerificationEnvironment, compileStack } from "./inventory.ts";
import { verificationEnvironment } from "./verification-settings.ts";

applyVerificationEnvironment();

const recipients = ["billing@example.com", "ops@example.com", "finance@example.com"];

const alertAddresses = Effect.fn("alertAddresses")(function* alertAddresses(
  ordered: readonly string[],
) {
  const inventory = yield* compileStack("email").pipe(
    Effect.provideService(
      ConfigProvider,
      fromEnv({
        env: { ...verificationEnvironment, [deploymentKey.alertEmail]: ordered.join(",") },
      }),
    ),
  );
  return Object.fromEntries(
    Object.entries(inventory.resources)
      .filter(([, resource]) => resource.type === "Cloudflare.Email.Address")
      .map(([id, resource]) => [id, resource.declared] as const),
  );
});

it.effect("keeps each alert address on the same logical id whatever the recipient order", () =>
  Effect.gen(function* program() {
    const declared = yield* alertAddresses(recipients);
    assert.deepStrictEqual(yield* alertAddresses(recipients.toReversed()), declared);
    assert.deepStrictEqual(
      yield* alertAddresses(recipients.filter((recipient) => recipient !== recipients[1])),
      Object.fromEntries(
        Object.entries(declared).filter(
          ([, value]) => JSON.stringify(value) !== JSON.stringify({ email: recipients[1] }),
        ),
      ),
    );
  }),
);
