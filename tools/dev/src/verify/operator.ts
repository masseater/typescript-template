import { APPLICATION } from "@repo/config";
import { Effect } from "effect";

import { authenticate } from "../authenticate.ts";
import { failure } from "../failure.ts";
import { ensureOperator, operatorFile } from "../operator-account.ts";

import type { ResolvedVerifyEnvironment } from "./environments.ts";

type OperatorVerifyReport = {
  readonly blockedOnInviteFlow: true;
  readonly email: string;
  readonly environment: ResolvedVerifyEnvironment["environment"];
  readonly event: "verify.operator_completed";
  readonly note: string;
  readonly ok: true;
  readonly operatorFile: string;
  readonly origin: string;
  readonly session: string;
};

const verifyOperator = Effect.fn("verifyOperator")(function* verifyOperator(
  resolved: ResolvedVerifyEnvironment,
) {
  yield* ensureOperator();
  const operator = yield* authenticate(APPLICATION.admin, []);
  const report: OperatorVerifyReport = {
    blockedOnInviteFlow: true,
    email: operator.email,
    environment: resolved.environment,
    event: "verify.operator_completed",
    note: "Operator accounts use the local bootstrap path until admin invite flow lands in #924. Replace ensureOperator with invite acceptance when that PR merges.",
    ok: true,
    operatorFile: operator.operatorFile,
    origin: operator.origin,
    session: operator.session,
  };
  if (resolved.environment !== "local") {
    return yield* failure("command_unsupported");
  }
  return report;
});

export { verifyOperator };
