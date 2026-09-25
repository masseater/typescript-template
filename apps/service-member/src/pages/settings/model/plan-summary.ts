import { PLAN, SUBSCRIPTION_STATUS } from "@repo/config";

import type { PlanView } from "#shared/contracts/index.ts";

type Plan = typeof PlanView.Type;

interface PlanSummary {
  readonly attention: string | undefined;
  readonly headline: string;
  readonly manageable: boolean;
  readonly periodEnd: { readonly canceling: boolean; readonly endsAt: Date } | undefined;
  readonly upgradable: boolean;
}

const attentionByStatus: Readonly<Partial<Record<NonNullable<Plan["status"]>, string>>> = {
  [SUBSCRIPTION_STATUS.incomplete]: "支払いの確認が終わるまで、有料の機能は使えません。",
  [SUBSCRIPTION_STATUS.pastDue]:
    "支払いに失敗しました。プランを管理する画面から支払い方法を更新してください。",
  [SUBSCRIPTION_STATUS.unpaid]:
    "支払いに失敗しました。プランを管理する画面から支払い方法を更新してください。",
};

function periodEndOf(plan: Plan): PlanSummary["periodEnd"] {
  if (plan.plan !== PLAN.paid || plan.currentPeriodEnd === undefined) {
    return undefined;
  }
  return { canceling: plan.cancelAtPeriodEnd, endsAt: plan.currentPeriodEnd };
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
