import { Button, Heading, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { saveOnboardingStep } from "../api/onboarding.ts";

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
    <main className="flex flex-col gap-4">
      <Heading as="h1" size="page">
        プロフィールの作り方
      </Heading>
      <p className="text-base leading-normal text-foreground">
        自分で入力するか、AI にインタビューしてもらうかを選べます。
      </p>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <Button
        disabled={action.blocked}
        onClick={() => {
          choose("profile");
        }}
        type="button"
        variant="primary"
      >
        自分で入力する
      </Button>
      <Button
        disabled={action.blocked}
        onClick={() => {
          choose("interview");
        }}
        type="button"
        variant="secondary"
      >
        AI にインタビューしてもらう
      </Button>
    </main>
  );
}

export { ChoosePage };
