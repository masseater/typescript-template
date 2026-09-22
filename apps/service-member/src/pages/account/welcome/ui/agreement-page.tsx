import { Button, Heading, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { PendingAgreementList, acceptAgreements } from "#entities/agreement/index.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";

import type { Agreements } from "#entities/agreement/index.ts";
import type { ReactElement } from "react";

function AgreementPage({ agreements }: Readonly<{ agreements: Agreements }>): ReactElement {
  const navigate = useNavigate();
  const action = useAction();
  const { pending } = agreements;

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
          action.run(() => {
            const accepted =
              pending.length > 0
                ? acceptAgreements(pending.map((agreement) => agreement.id))
                : Promise.resolve();
            return accepted
              .then(() => saveOnboardingStep("choose"))
              .then(() => navigate({ to: "/welcome/choose" }));
          });
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
