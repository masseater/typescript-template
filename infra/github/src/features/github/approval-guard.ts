import { Effect, type Redacted, Schema } from "effect";

import { gitHubRequest } from "./github-api.ts";

const RunApprovals = Schema.Array(
  Schema.Struct({
    environments: Schema.Array(Schema.Struct({ name: Schema.String })),
    state: Schema.String,
  }),
);

class ApprovalGuardFailure extends Schema.TaggedError<ApprovalGuardFailure>()(
  "ApprovalGuardFailure",
  {
    code: Schema.Literals(["removal_approval_missing"]),
    environment: Schema.String,
  },
) {}

const requireRemovalApproval = Effect.fn("requireRemovalApproval")(function* requireRemovalApproval(
  gate: Readonly<{
    environment: string;
    repository: string;
    runId: string;
    token: Redacted.Redacted;
  }>,
) {
  const approvals = yield* gitHubRequest(RunApprovals, {
    method: "GET",
    path: `/repos/${gate.repository}/actions/runs/${gate.runId}/approvals`,
    step: "removal_approval",
    token: gate.token,
  });
  const approvedEnvironments = approvals
    .filter((approval) => approval.state === "approved")
    .flatMap((approval) => approval.environments);
  if (!approvedEnvironments.some((environment) => environment.name === gate.environment)) {
    return yield* new ApprovalGuardFailure({
      code: "removal_approval_missing",
      environment: gate.environment,
    });
  }
});

export { ApprovalGuardFailure, requireRemovalApproval };
