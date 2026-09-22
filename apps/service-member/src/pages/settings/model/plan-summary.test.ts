import { PLAN, SUBSCRIPTION_STATUS } from "@repo/config";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { summarizePlan } from "./plan-summary.ts";

const periodEnd = DateTime.toDate(DateTime.makeUnsafe("2026-10-20T00:00:00Z"));

describe("summarizePlan", () => {
  it("offers the upgrade and nothing to manage to a member without any contract", () => {
    expect.hasAssertions();
    expect(
      summarizePlan({ cancelAtPeriodEnd: false, plan: PLAN.free, status: undefined }),
    ).toStrictEqual({
      attention: undefined,
      headline: "無料プラン",
      manageable: false,
      periodEnd: undefined,
      upgradable: true,
    });
  });

  it("shows the period end and the portal to a paying member", () => {
    expect.hasAssertions();
    const summary = summarizePlan({
      cancelAtPeriodEnd: false,
      currentPeriodEnd: periodEnd,
      plan: PLAN.paid,
      status: SUBSCRIPTION_STATUS.active,
    });
    expect(summary).toMatchObject({
      attention: undefined,
      headline: "有料プラン",
      manageable: true,
      upgradable: false,
    });
    expect(summary.periodEnd).toMatch(/^現在の期間は .+ までです。$/u);
  });

  it("tells a member who canceled that the plan ends with the period", () => {
    expect.hasAssertions();
    const summary = summarizePlan({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd,
      plan: PLAN.paid,
      status: SUBSCRIPTION_STATUS.active,
    });
    expect(summary.periodEnd).toMatch(/に解約され、その後は無料プランになります。$/u);
  });

  it("keeps the portal reachable after the contract lapsed so payment can be fixed", () => {
    expect.hasAssertions();
    expect(
      summarizePlan({
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
        plan: PLAN.free,
        status: SUBSCRIPTION_STATUS.pastDue,
      }),
    ).toStrictEqual({
      attention: "支払いに失敗しました。プランを管理する画面から支払い方法を更新してください。",
      headline: "無料プラン",
      manageable: true,
      periodEnd: undefined,
      upgradable: true,
    });
  });
});
