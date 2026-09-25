import { gitHubApiOrigin, httpStatus } from "@repo/config";
import { Effect, Redacted, Result } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { operatorAccess } from "./access.ts";
import { approvalSubject, plannedEvent } from "./plan-event.ts";

const operatorToken = "operator-token";
const operator = { principal: "operator", repository: "acme/widgets" };

describe("operatorAccess", () => {
  describe.for([
    ["an administrator", { admin: true, token: operatorToken }, operator],
    [
      "a collaborator without admin",
      { admin: false, token: operatorToken },
      ["admin_permission_missing", "repository"],
    ],
    [
      "a token GitHub does not accept",
      { admin: true, token: "revoked-token" },
      ["github_refused", "principal"],
    ],
  ] as const)("%s", ([, scenario, promised]) => {
    const it = test.extend("access", ({}, { onCleanup }) => {
      const gitHubApi = setupServer(
        http.get(`${gitHubApiOrigin}/user`, ({ request }) =>
          request.headers.get("authorization") === `Bearer ${operatorToken}`
            ? HttpResponse.json({ login: "operator" })
            : HttpResponse.json({}, { status: httpStatus.unauthorized }),
        ),
        http.get(`${gitHubApiOrigin}/repos/acme/widgets`, () =>
          HttpResponse.json({ permissions: { admin: scenario.admin } }),
        ),
      );
      gitHubApi.listen({ onUnhandledRequest: "error" });
      onCleanup(() => {
        gitHubApi.close();
      });
      return Effect.runPromise(
        Effect.result(
          operatorAccess({ owner: "acme", repository: "widgets" }, Redacted.make(scenario.token)),
        ).pipe(
          Effect.map((granted) =>
            Result.isSuccess(granted)
              ? granted.success
              : [granted.failure.code, granted.failure.step],
          ),
        ),
      );
    });

    it("names the account and the repository it may administer", ({ access }) => {
      expect(access).toStrictEqual(promised);
    });
  });
});

describe("plannedEvent", () => {
  const it = test.extend("plannedRecord", () =>
    plannedEvent(operator, {
      confirmation: "0000000000000000",
      plan: { rows: [], stack: "template-github" },
    }));

  it("shows the repository it writes to and the account it writes as", ({ plannedRecord }) => {
    expect(plannedRecord).toStrictEqual({
      confirmation: "0000000000000000",
      event: "github.planned",
      plan: { rows: [], stack: "template-github" },
      principal: "operator",
      repository: "acme/widgets",
    });
  });
});

describe("approvalSubject", () => {
  const it = test.extend("subjectLine", () => approvalSubject(operator));

  it("binds the confirmation to the repository and the account", ({ subjectLine }) => {
    expect(subjectLine).toBe("acme/widgets as operator");
  });
});
