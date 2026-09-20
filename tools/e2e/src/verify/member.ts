import { Effect } from "effect";
import { chromium } from "playwright";

import { agentUserAgent } from "../agent-user-agent.ts";
import { browserHeaders } from "../client-address.ts";
import { enableVirtualAuthenticator } from "../passkey.ts";
import { mailDelivery, runVerifyMember } from "../verify-member.ts";
import { failure } from "./failure.ts";

import type { ResolvedVerifyEnvironment } from "./environments.ts";

const verifyMember = Effect.fn("verifyMember")(function* verifyMember(
  resolved: ResolvedVerifyEnvironment,
) {
  const mail =
    resolved.mailboxUrl !== undefined
      ? mailDelivery({ mailboxUrl: resolved.mailboxUrl })
      : resolved.mailpitOrigin !== undefined
        ? mailDelivery({ mailpitOrigin: resolved.mailpitOrigin })
        : undefined;
  if (mail === undefined) {
    return yield* failure("command_unsupported");
  }
  const browser = yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: async () =>
      chromium.launch({
        args: ["--disable-dev-shm-usage", "--enable-features=WebAuthentication"],
      }),
  });
  const headers = browserHeaders();
  const browserSession = yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: async () =>
      browser.newContext({
        extraHTTPHeaders: headers,
        locale: "ja-JP",
        userAgent: agentUserAgent,
      }),
  });
  const page = yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: async () => {
      const openedPage = await browserSession.newPage();
      await enableVirtualAuthenticator(openedPage);
      return openedPage;
    },
  });
  const verified = yield* Effect.tryPromise({
    catch: () => failure("browser_authentication_failed"),
    try: async () =>
      runVerifyMember({
        mail,
        origin: resolved.memberOrigin,
        page,
      }),
  });
  yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: async () => {
      await browserSession.close();
      await browser.close();
    },
  });
  return {
    environment: resolved.environment,
    event: "verify.member_completed" as const,
    ok: true as const,
    requestIds: verified.requestIds,
    sessionToken: verified.sessionToken,
    traceIds: verified.traceIds,
    userAgent: verified.userAgent,
    userId: verified.userId,
  };
});

export { verifyMember };
