import { Page, StatusMessage } from "@repo/ui";
import { useEffect, useState } from "react";

import { loadRecoveryOffer } from "#pages/recovery/api/recovery.ts";
import { RecoveryChoice } from "#pages/recovery/ui/recovery-choice.tsx";

import type { ReactElement } from "react";

function SettingsRecoveryPage(): ReactElement | null {
  const [offer, setOffer] = useState<
    Readonly<{ available: false }> | Readonly<{ available: true; previousName: string }> | undefined
  >(undefined);
  useEffect(() => {
    void loadRecoveryOffer().then(setOffer);
  }, []);
  if (offer === undefined) {
    return null;
  }
  if (!offer.available) {
    return (
      <Page title="データの復旧">
        <StatusMessage>いま復旧できる過去のデータはありません。</StatusMessage>
      </Page>
    );
  }
  return (
    <RecoveryChoice
      previousName={offer.previousName}
      onDecided={() => {
        void loadRecoveryOffer().then(setOffer);
      }}
    />
  );
}

export { SettingsRecoveryPage };
