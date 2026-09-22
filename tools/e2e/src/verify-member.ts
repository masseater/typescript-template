import { Effect, type Crypto } from "effect";

import { type Account, newAccount } from "./accounts.ts";
import { agentUserAgent } from "./agent-user-agent.ts";
import {
  answerTotpChallenge,
  enrollTotp,
  homePattern,
  registerPasskey,
  signIn,
  signInWithPasskey,
  signOut,
  signUp,
  updateProfile,
} from "./flows.ts";
import { type JourneyFailure } from "./journey-failure.ts";
import { waitForMailboxLink } from "./mailbox-url.ts";
import { waitForMailpitLink } from "./mailpit-client.ts";
import { attachObservabilityCapture, readSession } from "./observability-capture.ts";
import { appearanceTimeout, pageStep, press, seeHeading, seeText } from "./screens.ts";

import type { Page } from "playwright";

type MailDelivery = {
  readonly mailboxUrl?: string;
  readonly mailpitOrigin?: string;
  readonly waitForLink: (
    recipient: string,
    prefix: string,
  ) => Effect.Effect<string, JourneyFailure>;
};

const mailDelivery = (settings: {
  readonly mailboxUrl?: string;
  readonly mailpitOrigin?: string;
}): MailDelivery => {
  const { mailboxUrl, mailpitOrigin } = settings;
  if (mailboxUrl !== undefined) {
    return {
      mailboxUrl,
      waitForLink: (recipient, prefix) =>
        waitForMailboxLink({
          deliveriesUrl: `${mailboxUrl.replace(/\/$/u, "")}/messages?to=${encodeURIComponent(recipient)}`,
          prefix,
          recipient,
        }),
    };
  }
  if (mailpitOrigin === undefined) {
    throw new Error("VERIFY_MAIL_DELIVERY_UNAVAILABLE");
  }
  return {
    mailpitOrigin,
    waitForLink: (recipient, prefix) =>
      waitForMailpitLink({
        messageUrl: (messageId) => `${mailpitOrigin}/api/v1/message/${messageId}`,
        prefix,
        recipient,
        searchUrl: `${mailpitOrigin}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`,
      }),
  };
};

const completeWelcomeOnboarding = (onboarding: {
  readonly account: Account;
  readonly origin: string;
  readonly page: Page;
}): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* finishWelcome() {
    yield* pageStep(() => onboarding.page.waitForURL((url) => url.pathname.includes("/welcome")));
    yield* seeHeading(onboarding.page, "規約への同意");
    yield* press(onboarding.page, "同意して続ける");
    yield* seeHeading(onboarding.page, "プロフィールの作り方");
    yield* press(onboarding.page, "自分で入力する");
    yield* seeHeading(onboarding.page, "基本項目の入力");
    yield* pageStep(() =>
      onboarding.page
        .getByLabel("ユーザー名", { exact: true })
        .first()
        .fill(onboarding.account.name),
    );
    yield* press(onboarding.page, "保存してホームへ");
    yield* pageStep(() => onboarding.page.waitForURL(`${onboarding.origin}/home`));
  });

const verifyEmailAndSignIn = (signup: {
  readonly account: Account;
  readonly mail: MailDelivery;
  readonly origin: string;
  readonly page: Page;
}): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* verifyThenSignIn() {
    yield* seeHeading(signup.page, "確認メールを送りました");
    const verificationPrefix = `${signup.origin}/verify-email`;
    const link = yield* signup.mail.waitForLink(signup.account.email, verificationPrefix);
    yield* pageStep(() => signup.page.goto(link));
    yield* pageStep(() => signup.page.waitForURL(`${signup.origin}/login`));
    yield* signIn({ account: signup.account, origin: signup.origin, page: signup.page });
  });

type VerifyMemberResult = {
  readonly biography: string;
  readonly enrolledTotp: boolean;
  readonly passkeyRegistered: boolean;
  readonly requestIds: readonly string[];
  readonly sessionToken: string | undefined;
  readonly traceIds: readonly string[];
  readonly userAgent: string;
  readonly userId: string | undefined;
};

const finalizeVerifyMember = (finalization: {
  readonly biography: string;
  readonly capture: ReturnType<typeof attachObservabilityCapture>;
  readonly origin: string;
  readonly page: Page;
}): Effect.Effect<VerifyMemberResult, JourneyFailure> =>
  Effect.gen(function* finalizeVerification() {
    yield* pageStep(() => finalization.page.goto(`${finalization.origin}/settings/profile`));
    yield* seeText(finalization.page, finalization.biography);
    const session = yield* readSession(finalization.page, `${finalization.origin}/api/session`);
    finalization.capture.stop();
    return {
      biography: finalization.biography,
      enrolledTotp: true,
      passkeyRegistered: true,
      requestIds: finalization.capture.requestIds,
      sessionToken: session.sessionToken,
      traceIds: finalization.capture.traceIds,
      userAgent: agentUserAgent,
      userId: session.userId,
    };
  });

const secureMemberAccount = (visit: {
  readonly account: Account;
  readonly origin: string;
  readonly page: Page;
}): Effect.Effect<{ readonly biography: string }, JourneyFailure> =>
  Effect.gen(function* secureAccount() {
    const { biography } = yield* updateProfile(visit);
    const enrollment = yield* enrollTotp(visit);
    yield* registerPasskey(visit, "verify passkey");
    yield* signOut(visit.page, visit.origin);
    yield* signIn({ account: visit.account, origin: visit.origin, page: visit.page });
    yield* answerTotpChallenge(visit.page, enrollment.uri);
    yield* pageStep(() =>
      visit.page.waitForURL(`${visit.origin}${homePattern}`, { timeout: appearanceTimeout }),
    );
    yield* signOut(visit.page, visit.origin);
    yield* signInWithPasskey({ account: visit.account, origin: visit.origin, page: visit.page });
    return { biography };
  });

const runVerifyMember = (settings: {
  readonly mail: MailDelivery;
  readonly origin: string;
  readonly page: Page;
}): Effect.Effect<VerifyMemberResult, JourneyFailure, Crypto.Crypto> =>
  Effect.gen(function* verifyMemberJourney() {
    const { mail, origin, page } = settings;
    const capture = attachObservabilityCapture(page);
    const account = yield* newAccount("verify-member");
    yield* signUp({ account, origin, page });
    yield* verifyEmailAndSignIn({ account, mail, origin, page });
    yield* completeWelcomeOnboarding({ account, origin, page });
    const { biography } = yield* secureMemberAccount({ account, origin, page });
    return yield* finalizeVerifyMember({ biography, capture, origin, page });
  });

export { mailDelivery, runVerifyMember };
