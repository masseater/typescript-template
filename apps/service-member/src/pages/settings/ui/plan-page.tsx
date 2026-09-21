import {
  ActionStatus,
  Button,
  ButtonLink,
  FormColumn,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  useAction,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { openPortal } from "#pages/settings/api/plan.ts";
import { summarizePlan } from "#pages/settings/model/plan-summary.ts";

import type { Plan } from "#pages/settings/api/plan.ts";
import type { ReactElement } from "react";

function PlanPage({
  awaitingCheckout,
  plan,
}: Readonly<{ awaitingCheckout: boolean; plan: Plan }>): ReactElement {
  const router = useRouter();
  const action = useAction();
  const summary = summarizePlan(plan);
  function manage(): void {
    action.run(openPortal);
  }
  function reload(): void {
    void router.invalidate();
  }
  return (
    <Page title="プランと解約">
      <p>
        いまのプラン: <strong>{summary.headline}</strong>
      </p>
      {summary.periodEnd !== undefined && <p>{summary.periodEnd}</p>}
      {summary.attention !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{summary.attention}</StatusMessage>
      )}
      {awaitingCheckout && summary.upgradable && (
        <StatusMessage variant={STATUS_VARIANT.pending}>
          契約の手続きを受け付けました。反映まで少し時間がかかることがあります。
        </StatusMessage>
      )}
      <FormColumn>
        {summary.upgradable && (
          <ButtonLink to="/upgrade" variant="primary">
            有料プランを見る
          </ButtonLink>
        )}
        {awaitingCheckout && summary.upgradable && (
          <Button type="button" onClick={reload}>
            最新の状態を確かめる
          </Button>
        )}
        {summary.manageable && (
          <Button type="button" variant="primary" disabled={action.blocked} onClick={manage}>
            プランを管理する
          </Button>
        )}
      </FormColumn>
      {summary.manageable && (
        <p className="text-muted-foreground">
          解約や支払い方法の変更は、支払い事業者の管理ページで行います。解約しても現在の期間の末までは有料プランのまま使えます。
        </p>
      )}
      <ActionStatus action={action} pendingMessage="管理ページへ移動しています。" />
    </Page>
  );
}

export { PlanPage };
