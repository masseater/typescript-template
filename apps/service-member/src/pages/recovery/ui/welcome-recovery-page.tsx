import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useRecoveryOffer } from "#pages/recovery/model/recovery-offer.ts";
import { RecoveryChoice } from "#pages/recovery/ui/recovery-choice.tsx";

import type { ReactElement } from "react";

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
  const available = offer?.available === true;
  useEffect(() => {
    if (offer === undefined || available) {
      return;
    }
    void navigate({ replace: true, to: nextPath });
  }, [available, navigate, nextPath, offer]);
  if (error !== undefined) {
    return (
      <Page title="過去のデータの復旧">
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
      </Page>
    );
  }
  if (offer === undefined || !offer.available) {
    return (
      <Page title="過去のデータの復旧">
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      </Page>
    );
  }
  return (
    <RecoveryChoice
      previousName={offer.previousName}
      onDecided={() => {
        void navigate({ to: nextPath });
      }}
    />
  );
}

export { WelcomeRecoveryPage };
