import { agentUserAgent } from "@repo/e2e/agent-user-agent";
import { browserHeaders } from "@repo/e2e/client-address";
import { enableVirtualAuthenticator } from "@repo/e2e/passkey";
import { mailDelivery, runVerifyMember } from "@repo/e2e/verify-member";
import { Effect } from "effect";
import { chromium } from "playwright";

import { failure } from "../failure.ts";

import type { ResolvedVerifyEnvironment } from "./environments.ts";

type MemberVerifyReport = {
  readonly environment: ResolvedVerifyEnvironment["environment"];
  readonly event: "verify.member_completed";
  readonly ok: true;
  readonly requestIds: readonly string[];
  readonly sessionToken: string | undefined;
  readonly traceIds: readonly string[];
  readonly userAgent: string;
  readonly userId: string | undefined;
};

const verifyMember = Effect.fn("verifyMember")(function* verifyMember(
  resolved: ResolvedVerifyEnvironment,
) {
  const browser = yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: async () =>
      chromium.launch({
        args: ["--disable-dev-shm-usage"],
      }),
  });
  const headers = browserHeaders();
  const context = yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: async () => {
      return browser.newContext({
        extraHTTPHeaders: headers,
        locale: "ja-JP",
        userAgent: agentUserAgent,
      });
    },
  });
  const page = yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: async () => {
      const openedPage = await context.newPage();
      await enableVirtualAuthenticator(openedPage);
      return openedPage;
    },
  });
  const verified = yield* Effect.tryPromise({
    catch: () => failure("browser_authentication_failed"),
    try: async () =>
      runVerifyMember({
        mail: mailDelivery({
          mailboxUrl: resolved.mailboxUrl,
          mailpitOrigin: resolved.mailpitOrigin,
        }),
        origin: resolved.memberOrigin,
        page,
      }),
  });
  yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: async () => {
      await context.close();
      await browser.close();
    },
  });
  const report: MemberVerifyReport = {
    environment: resolved.environment,
    event: "verify.member_completed",
    ok: true,
    requestIds: verified.requestIds,
    sessionToken: verified.sessionToken,
    traceIds: verified.traceIds,
    userAgent: verified.userAgent,
    userId: verified.userId,
  };
  return report;
});

export { verifyMember };
