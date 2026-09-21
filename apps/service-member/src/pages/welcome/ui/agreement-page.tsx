import { Button, Heading, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";

import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function acceptAgreement(goToChoose: () => Promise<unknown>): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* accept() {
      yield* Effect.promise(() => saveOnboardingStep("choose"));
      yield* Effect.promise(() => goToChoose());
    }),
  );
}

function AgreementPage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();

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
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <Button
        disabled={action.blocked}
        onClick={() => {
          action.run(() => acceptAgreement(() => navigate({ to: "/welcome/choose" })));
        }}
        type="button"
        variant="primary"
      >
        同意して続ける
      </Button>
    </main>
  );
}

export { AgreementPage };
