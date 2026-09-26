import { gitHubApiOrigin } from "@repo/config";
import { Effect, Redacted } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { requireRemovalApproval } from "./index.ts";

const approvalsApi = `${gitHubApiOrigin}/repos/acme/widgets/actions/runs/7001/approvals`;
const token = "ghs_workflow_fixture";

describe.each([
  {
    approvals: [{ environments: [{ name: "staging-removal-approval" }], state: "approved" }],
    title: "lets the deploy continue once a reviewer approved this run",
    verdict: { _tag: "Success" },
  },
  {
    approvals: [{ environments: [{ name: "staging-removal-approval" }], state: "rejected" }],
    title: "stops the deploy when the reviewer rejected it",
    verdict: { _tag: "Failure", code: "removal_approval_missing" },
  },
  {
    approvals: [{ environments: [{ name: "production-removal-approval" }], state: "approved" }],
    title: "stops the deploy when only another environment was approved",
    verdict: { _tag: "Failure", code: "removal_approval_missing" },
  },
  {
    approvals: [],
    title: "stops the deploy when the environment let the run through without a reviewer",
    verdict: { _tag: "Failure", code: "removal_approval_missing" },
  },
] as const)("$title", ({ approvals, verdict }) => {
  const it = test.extend("guardVerdict", ({}, { onCleanup }) => {
    const gitHubApi = setupServer(
      http.get(approvalsApi, ({ request }) =>
        request.headers.get("authorization") === `Bearer ${token}`
          ? HttpResponse.json(approvals)
          : HttpResponse.json({}, { status: 401 }),
      ),
    );
    gitHubApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      gitHubApi.close();
    });
    return Effect.runPromise(
      requireRemovalApproval({
        environment: "staging-removal-approval",
        repository: "acme/widgets",
        runId: "7001",
        token: Redacted.make(token),
      }).pipe(
        Effect.match({
          onFailure: (failure) => ({ _tag: "Failure", code: failure.code }),
          onSuccess: () => ({ _tag: "Success" }),
        }),
      ),
    );
  });

  it("answers from the approvals GitHub recorded for the run", ({ guardVerdict }) => {
    expect(guardVerdict).toStrictEqual(verdict);
  });
});
