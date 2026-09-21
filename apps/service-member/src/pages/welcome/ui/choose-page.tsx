import { useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { saveOnboardingStep } from "../api/onboarding.ts";
import { ChooseView } from "./choose-view.tsx";

import type { ReactElement } from "react";

function ChoosePage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();

  const choose = (step: "interview" | "profile"): void => {
    action.run(async () => {
      await saveOnboardingStep(step);
      await navigate({ to: step === "profile" ? "/welcome/profile" : "/welcome/interview" });
    });
  };

  return (
    <ChooseView
      blocked={action.blocked}
      {...(action.error === undefined ? {} : { error: action.error })}
      onInterview={() => {
        choose("interview");
      }}
      onProfile={() => {
        choose("profile");
      }}
    />
  );
}

export { ChoosePage };
