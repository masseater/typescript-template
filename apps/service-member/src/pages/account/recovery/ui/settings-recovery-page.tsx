import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useRecoveryOffer } from "#pages/account/recovery/model/recovery-offer.ts";
import { RecoveryChoice } from "#pages/account/recovery/ui/recovery-choice.tsx";

import type { ReactElement } from "react";

function SettingsRecoveryPage(): ReactElement {
  const { error, offer, reload } = useRecoveryOffer();
  if (error !== undefined) {
    return (
      <Page title="データの復旧">
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
      </Page>
    );
  }
  if (offer === undefined) {
    return (
      <Page title="データの復旧">
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      </Page>
    );
  }
  if (!offer.available) {
    return (
      <Page title="データの復旧">
        <StatusMessage>いま復旧できる過去のデータはありません。</StatusMessage>
      </Page>
    );
  }
  return <RecoveryChoice previousName={offer.previousName} onDecided={reload} />;
}

export { SettingsRecoveryPage };
