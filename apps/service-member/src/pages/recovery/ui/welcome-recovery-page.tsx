import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useRecoveryOffer } from "#pages/recovery/model/recovery-offer.ts";
import { RecoveryChoice } from "#pages/recovery/ui/recovery-choice.tsx";

import type { RecoveryOfferView } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

type RecoveryOffer = typeof RecoveryOfferView.Type;

function availableOffer(
  offer: RecoveryOffer | undefined,
): Extract<RecoveryOffer, { available: true }> | undefined {
  return offer?.available === true ? offer : undefined;
}

function RecoveryWaiting({ error }: Readonly<{ error: string | undefined }>): ReactElement {
  return (
    <Page title="過去のデータの復旧">
      {error === undefined ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      ) : (
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
      )}
    </Page>
  );
}

function WelcomeRecoveryPage({
  nextPath,
}: Readonly<{
  nextPath:
    | "/home"
    | "/welcome/agreement"
    | "/welcome/choose"
    | "/welcome/interview"
    | "/welcome/profile";
}>): ReactElement {
  const navigate = useNavigate();
  const { error, offer } = useRecoveryOffer();
  const choice = availableOffer(offer);
  const available = choice !== undefined;
  useEffect(() => {
    if (offer === undefined || available) {
      return;
    }
    void navigate({ replace: true, to: nextPath });
  }, [available, navigate, nextPath, offer]);
  if (error !== undefined || choice === undefined) {
    return <RecoveryWaiting error={error} />;
  }
  return (
    <RecoveryChoice
      previousName={choice.previousName}
      onDecided={() => {
        void navigate({ to: nextPath });
      }}
    />
  );
}

export { WelcomeRecoveryPage };
