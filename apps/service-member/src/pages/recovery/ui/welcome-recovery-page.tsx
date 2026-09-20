import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { loadRecoveryOffer } from "#pages/recovery/api/recovery.ts";
import { RecoveryChoice } from "#pages/recovery/ui/recovery-choice.tsx";

const agreementPath = "/welcome/agreement";

import type { ReactElement } from "react";

function WelcomeRecoveryPage(): ReactElement | null {
  const navigate = useNavigate();
  const [offer, setOffer] = useState<
    Readonly<{ available: false }> | Readonly<{ available: true; previousName: string }> | undefined
  >(undefined);
  useEffect(() => {
    void loadRecoveryOffer().then((loaded) => {
      setOffer(loaded);
      if (!loaded.available) {
        void navigate({ to: agreementPath });
      }
    });
  }, [navigate]);
  if (offer === undefined || !offer.available) {
    return null;
  }
  return (
    <RecoveryChoice
      previousName={offer.previousName}
      onDecided={() => {
        void navigate({ to: agreementPath });
      }}
    />
  );
}

export { WelcomeRecoveryPage };
