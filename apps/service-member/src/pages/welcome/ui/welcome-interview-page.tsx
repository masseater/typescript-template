import { Button, Heading, STATUS_VARIANT, StatusMessage, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function WelcomeInterviewPage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();

  const finish = (): void => {
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
        <Button disabled={action.blocked} onClick={finish} type="button" variant="secondary">
          インタビューをスキップ
        </Button>
      </div>
      <StatusMessage variant={STATUS_VARIANT.pending}>
        登録直後の AI
        インタビュー本体は、設定のインタビューと合わせて後続で接続します。いまはスキップしてホームへ進めます。
      </StatusMessage>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <Button disabled={action.blocked} onClick={finish} type="button" variant="primary">
        ホームへ進む
      </Button>
    </main>
  );
}

export { WelcomeInterviewPage };
