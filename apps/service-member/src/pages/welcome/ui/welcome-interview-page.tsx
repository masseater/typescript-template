import { Button, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function WelcomeInterviewPage(): ReactElement {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const finish = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await saveOnboardingStep("done");
      await navigate({ to: "/home" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "進めませんでした。");
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Heading as="h1" size="page">
          AI インタビュー
        </Heading>
        <Button disabled={busy} onClick={() => void finish()} type="button" variant="secondary">
          インタビューをスキップ
        </Button>
      </div>
      <StatusMessage variant={STATUS_VARIANT.pending}>
        登録直後の AI
        インタビュー本体は、設定のインタビューと合わせて後続で接続します。いまはスキップしてホームへ進めます。
      </StatusMessage>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      <Button disabled={busy} onClick={() => void finish()} type="button" variant="primary">
        ホームへ進む
      </Button>
    </main>
  );
}

export { WelcomeInterviewPage };
