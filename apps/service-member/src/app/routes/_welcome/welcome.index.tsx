import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";

import { welcomePath } from "#app/entry-conditions.ts";
import { loadOnboardingStep } from "#pages/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/")({
  beforeLoad: () =>
    Effect.runPromise(
      Effect.gen(function* welcomeIndex() {
        const step = yield* Effect.promise(() => loadOnboardingStep());
        if (step === "done") {
          throw redirect({ to: "/home" });
        }
        throw redirect({ to: welcomePath[step] });
      }),
    ),
});

export { Route };
