import {
  ActionStatus,
  Button,
  ButtonLink,
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  useAction,
} from "@repo/ui";
import { useCanGoBack, useRouter } from "@tanstack/react-router";

import { startCheckout } from "#pages/upgrade/api/checkout.ts";
import { describeOffer } from "#pages/upgrade/model/offer-text.ts";

import type { Offer } from "#pages/upgrade/api/checkout.ts";
import type { ReactElement } from "react";

const benefits = ["他の利用者を探す", "まだやり取りの無い相手へメッセージを送る"] as const;

function StayFree(): ReactElement {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  function back(): void {
    router.history.back();
  }
  return canGoBack ? (
    <Button type="button" onClick={back}>
      いまは無料のまま使う
    </Button>
  ) : (
    <ButtonLink to="/home">いまは無料のまま使う</ButtonLink>
  );
}

function UpgradePage({
  canceled,
  offer,
}: Readonly<{ canceled: boolean; offer: Offer }>): ReactElement {
  const action = useAction();
  function subscribe(): void {
    action.run(startCheckout);
  }
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8">
      <Heading as="h1" size="page">
        有料プラン
      </Heading>
      <ul className="list-disc pl-6">
        {benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <p>{describeOffer(offer)}</p>
      {canceled && <StatusMessage>手続きを途中でやめました。まだ契約していません。</StatusMessage>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={action.blocked} onClick={subscribe}>
          契約する
        </Button>
        <StayFree />
      </div>
      <ActionStatus action={action} pendingMessage="支払いの手続きへ移動しています。" />
      {action.pending && (
        <StatusMessage variant={STATUS_VARIANT.pending}>
          手続きの画面で支払いを完了すると、有料プランになります。
        </StatusMessage>
      )}
    </main>
  );
}

export { UpgradePage };
