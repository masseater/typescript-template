import { Button, Heading, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";

import {
  PendingAgreementList,
  acceptAgreements,
  signupAgreementKinds,
} from "#entities/agreement/index.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";

import type { Agreements } from "#entities/agreement/index.ts";
import type { ReactElement } from "react";

function acceptAgreement(
  agreements: Agreements,
  goToChoose: () => Promise<unknown>,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* accept() {
      const pending = signupAgreementKinds(agreements.pending);
      if (pending.length > 0) {
        yield* Effect.promise(() => acceptAgreements(pending.map((agreement) => agreement.id)));
      }
      yield* Effect.promise(() => saveOnboardingStep("choose"));
      yield* Effect.promise(() => goToChoose());
    }),
  );
}

function AgreementPage({ agreements }: Readonly<{ agreements: Agreements }>): ReactElement {
  const navigate = useNavigate();
  const action = useAction();
  const pending = signupAgreementKinds(agreements.pending);

  return (
    <main className="flex flex-col gap-4">
      <Heading as="h1" size="page">
        規約への同意
      </Heading>
      <p className="text-base leading-normal text-foreground">
        利用を続けるには、利用規約とプライバシーポリシーへの同意が必要です。
      </p>
      <PendingAgreementList pending={pending} />
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <Button
        disabled={action.blocked}
        onClick={() => {
          action.run(() => acceptAgreement(agreements, () => navigate({ to: "/welcome/choose" })));
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
