import { Effect } from "effect";
import { chromium, type BrowserContext, type Page } from "playwright";

import { agentUserAgent } from "../agent-user-agent.ts";
import { browserHeaders } from "../client-address.ts";
import { enableVirtualAuthenticator } from "../passkey.ts";
import { mailDelivery, runVerifyMember } from "../verify-member.ts";
import { failure } from "./failure.ts";

import type { ResolvedVerifyEnvironment } from "./environments.ts";

const openVerifiedPage = (browserSession: BrowserContext): Effect.Effect<Page> =>
  Effect.gen(function* launchVerifiedPage() {
    const openedPage = yield* Effect.tryPromise(() => browserSession.newPage());
    yield* Effect.tryPromise(() => enableVirtualAuthenticator(openedPage));
    return openedPage;
  }).pipe(Effect.orDie);

const closeBrowserSession = (
  browserSession: BrowserContext,
  browser: Awaited<ReturnType<typeof chromium.launch>>,
): Effect.Effect<void> =>
  Effect.gen(function* shutdownBrowser() {
    yield* Effect.tryPromise(() => browserSession.close());
    yield* Effect.tryPromise(() => browser.close());
  }).pipe(Effect.orDie);

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
    try: () =>
      chromium.launch({
        args: ["--disable-dev-shm-usage", "--enable-features=WebAuthentication"],
      }),
  });
  const headers = browserHeaders();
  const browserSession = yield* Effect.tryPromise({
    catch: () => failure("browser_start_failed"),
    try: () =>
      browser.newContext({
        extraHTTPHeaders: headers,
        locale: "ja-JP",
        userAgent: agentUserAgent,
      }),
  });
  const page = yield* openVerifiedPage(browserSession).pipe(
    Effect.mapError(() => failure("browser_start_failed")),
  );
  const verified = yield* runVerifyMember({
    mail,
    origin: resolved.memberOrigin,
    page,
  }).pipe(Effect.mapError(() => failure("browser_authentication_failed")));
  yield* closeBrowserSession(browserSession, browser).pipe(
    Effect.mapError(() => failure("browser_start_failed")),
  );
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
