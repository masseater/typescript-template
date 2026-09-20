import { Button, Heading } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function AgreementPage(): ReactElement {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const onAgree = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await saveOnboardingStep("choose");
      globalThis.location.assign("/welcome/choose");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "同意を保存できませんでした。");
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-col gap-4">
      <Heading as="h1" size="page">
        規約への同意
      </Heading>
      <p className="text-base leading-normal text-foreground">
        利用を続けるには、利用規約とプライバシーポリシーへの同意が必要です。
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-normal text-muted-foreground">
        <li>利用規約</li>
        <li>プライバシーポリシー</li>
      </ul>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      <Button disabled={busy} onClick={() => void onAgree()} type="button" variant="primary">
        同意して続ける
      </Button>
    </main>
  );
}

export { AgreementPage };
