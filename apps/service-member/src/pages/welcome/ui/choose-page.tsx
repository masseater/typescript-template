import { Button, Heading } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function ChoosePage(): ReactElement {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const choose = async (step: "interview" | "profile"): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await saveOnboardingStep(step);
      await navigate({ to: step === "profile" ? "/welcome/profile" : "/welcome/interview" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "選択を保存できませんでした。");
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-col gap-4">
      <Heading as="h1" size="page">
        プロフィールの作り方
      </Heading>
      <p className="text-base leading-normal text-foreground">
        自分で入力するか、AI にインタビューしてもらうかを選べます。
      </p>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      <Button
        disabled={busy}
        onClick={() => void choose("profile")}
        type="button"
        variant="primary"
      >
        自分で入力する
      </Button>
      <Button
        disabled={busy}
        onClick={() => void choose("interview")}
        type="button"
        variant="secondary"
      >
        AI にインタビューしてもらう
      </Button>
    </main>
  );
}

export { ChoosePage };
