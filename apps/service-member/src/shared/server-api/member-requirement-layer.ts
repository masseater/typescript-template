import { configuredFeatureFlagsLayer } from "@repo/feature-flags";
import { readWorkerConfig } from "@repo/runtime/bindings";
import { Effect, Layer } from "effect";

import { Stripe } from "#shared/billing/index.ts";
import { Interviewer } from "#shared/interview/server.ts";
import { PhotoStore } from "#shared/photo/index.ts";
import { ProfileLayoutAssembler } from "#shared/profile-layout/assembler.ts";
import { opsMailLayer } from "./ops-mail.ts";

function memberRequirementLayer(environment: unknown) {
  return Layer.mergeAll(
    Layer.unwrap(
      readWorkerConfig(environment).pipe(
        Effect.flatMap((config) =>
          configuredFeatureFlagsLayer(config).pipe(
            Effect.map((flags) => Layer.mergeAll(opsMailLayer(config), flags)),
          ),
        ),
      ),
    ),
    Interviewer.fromEnvironment(environment),
    PhotoStore.fromFileStore(),
    ProfileLayoutAssembler.fromEnvironment(environment),
    Stripe.fromEnvironment(environment),
  );
}

export { memberRequirementLayer };
