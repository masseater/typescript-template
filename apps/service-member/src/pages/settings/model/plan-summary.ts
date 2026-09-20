import { PLAN, SUBSCRIPTION_STATUS } from "@repo/config";
import { formatWarekiDate } from "@repo/ui";

import type { Plan } from "#pages/settings/api/plan.ts";

interface PlanSummary {
  readonly attention: string | undefined;
  readonly headline: string;
  readonly manageable: boolean;
  readonly periodEnd: string | undefined;
  readonly upgradable: boolean;
}

const attentionByStatus: Readonly<Partial<Record<NonNullable<Plan["status"]>, string>>> = {
  [SUBSCRIPTION_STATUS.incomplete]: "支払いの確認が終わるまで、有料の機能は使えません。",
  [SUBSCRIPTION_STATUS.pastDue]:
    "支払いに失敗しました。プランを管理する画面から支払い方法を更新してください。",
  [SUBSCRIPTION_STATUS.unpaid]:
    "支払いに失敗しました。プランを管理する画面から支払い方法を更新してください。",
};

function periodEndOf(plan: Plan): string | undefined {
  if (plan.plan !== PLAN.paid || plan.currentPeriodEnd === undefined) {
    return undefined;
  }
  const date = formatWarekiDate(plan.currentPeriodEnd);
  return plan.cancelAtPeriodEnd
    ? `${date} に解約され、その後は無料プランになります。`
    : `現在の期間は ${date} までです。`;
}

function summarizePlan(plan: Plan): PlanSummary {
  return {
    attention: plan.status === undefined ? undefined : attentionByStatus[plan.status],
    headline: plan.plan === PLAN.paid ? "有料プラン" : "無料プラン",
    manageable: plan.status !== undefined,
    periodEnd: periodEndOf(plan),
    upgradable: plan.plan === PLAN.free,
  };
}

export { summarizePlan };
export type { PlanSummary };
