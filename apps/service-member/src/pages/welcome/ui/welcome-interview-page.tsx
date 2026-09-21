import { Button, Heading, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { InterviewSession } from "#widgets/interview-talk/index.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function WelcomeInterviewPage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();
  const leave = (): void => {
    action.run(async () => {
      await saveOnboardingStep("done");
      await navigate({ to: "/home" });
    });
  };
  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Heading as="h1" size="page">
          AI インタビュー
        </Heading>
        <Button disabled={action.blocked} onClick={leave} type="button" variant="secondary">
          インタビューをスキップ
        </Button>
      </div>
      <InterviewSession onSheetSaved={leave} suspended={action.blocked} />
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
    </main>
  );
}

export { WelcomeInterviewPage };
