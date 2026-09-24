import { httpStatus } from "@repo/config";

import type { PaidPlanRequired } from "@repo/db";
import type { FailureTable } from "@repo/runtime/http";

const paidFailures = {
  PaidPlanRequired: {
    message: "有料プランの契約が必要です。",
    status: httpStatus.paymentRequired,
  },
} as const satisfies FailureTable<PaidPlanRequired>;

export { paidFailures };
