import { createFileRoute, redirect } from "@tanstack/react-router";

import { welcomePath } from "#app/entry-conditions.ts";
import { loadOnboardingStep } from "#pages/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/")({
  beforeLoad: async () => {
    const step = await loadOnboardingStep();
    if (step === "done") {
      throw redirect({ to: "/home" });
    }
    throw redirect({ to: welcomePath[step] });
  },
});

export { Route };
