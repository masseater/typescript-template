import { createFileRoute } from "@tanstack/react-router";

import { welcomePath } from "#app/entry-conditions.ts";
import { WelcomeRecoveryRoute } from "#pages/recovery/index.ts";

import type { OnboardingStep } from "#shared/contracts/index.ts";

const Route = createFileRoute("/_welcome/welcome/recovery")({
  component: WelcomeRecoveryRoute,
  loader: ({
    context,
  }: Readonly<{
    context: Readonly<{ step: OnboardingStep }>;
  }>) => ({
    nextPath: context.step === "done" ? ("/home" as const) : welcomePath[context.step],
  }),
});

export { Route };
