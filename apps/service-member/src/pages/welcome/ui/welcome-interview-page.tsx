import { Button, Heading, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { InterviewRoom } from "#widgets/interview-room/index.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function WelcomeInterviewPage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();
  const finish = async (): Promise<void> => {
    await saveOnboardingStep("done");
    await navigate({ to: "/home" });
  };
  const skip = (): void => {
    action.run(finish);
  };

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Heading as="h1" size="page">
          AI インタビュー
        </Heading>
        <Button disabled={action.blocked} onClick={skip} type="button" variant="secondary">
          インタビューをスキップ
        </Button>
      </div>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <InterviewRoom onSaved={finish} />
    </main>
  );
}

export { WelcomeInterviewPage };
