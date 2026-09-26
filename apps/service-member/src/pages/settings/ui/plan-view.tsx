import {
  type ActionState,
  ActionStatus,
  Button,
  ButtonLink,
  FormColumn,
  Page,
  STATUS_VARIANT,
  StatusMessage,
  formatWarekiDate,
} from "@repo/ui";

import type { PlanSummary } from "#pages/settings/model/plan-summary.ts";
import type { ReactElement } from "react";

function PlanView({
  action,
  checkoutPending,
  onManage,
  onReload,
  summary,
}: Readonly<{
  action: ActionState;
  checkoutPending: boolean;
  onManage: () => void;
  onReload: () => void;
  summary: PlanSummary;
}>): ReactElement {
  return (
    <Page title="プランと解約">
      <p>
        いまのプラン: <strong>{summary.headline}</strong>
      </p>
      {summary.periodEnd !== undefined && (
        <p>
          {summary.periodEnd.canceling
            ? `${formatWarekiDate(summary.periodEnd.endsAt)} に解約され、その後は無料プランになります。`
            : `現在の期間は ${formatWarekiDate(summary.periodEnd.endsAt)} までです。`}
        </p>
      )}
      {summary.attention !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{summary.attention}</StatusMessage>
      )}
      {checkoutPending && (
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
        {checkoutPending && (
          <Button type="button" onClick={onReload}>
            最新の状態を確かめる
          </Button>
        )}
        {summary.manageable && (
          <Button type="button" variant="primary" disabled={action.blocked} onClick={onManage}>
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

export { PlanView };
