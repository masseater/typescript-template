import { verifySession } from "@repo/auth";
import { requirePaid } from "@repo/db";
import { httpStatus } from "@repo/observability";
import { Effect } from "effect";

import type { PaidPlanRequired } from "@repo/db";
import type { FailureTable } from "@repo/runtime/http";

const paidFailures = {
  PaidPlanRequired: {
    message: "有料プランの契約が必要です。",
    status: httpStatus.paymentRequired,
  },
} as const satisfies FailureTable<PaidPlanRequired>;

const requirePaidSession = Effect.fn("requirePaidSession")(function* requirePaidSession(
  headers: Headers,
) {
  const session = yield* verifySession(headers);
  yield* requirePaid(session.user.id);
  return session;
});

export { paidFailures, requirePaidSession };
