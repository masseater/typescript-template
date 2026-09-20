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
import { waitForMailboxLink } from "./mailbox-url.ts";
import { waitForMailpitLink } from "./mailpit-client.ts";
import { attachObservabilityCapture, readSession } from "./observability-capture.ts";
import { appearanceTimeout, seeHeading, seeText } from "./screens.ts";

import type { Page } from "playwright";

type MailDelivery = {
  readonly mailboxUrl?: string;
  readonly mailpitOrigin?: string;
  readonly waitForLink: (recipient: string, prefix: string) => Promise<string>;
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

const completeWelcomeOnboarding = async (onboarding: {
  readonly account: Account;
  readonly origin: string;
  readonly page: Page;
}): Promise<void> => {
  await onboarding.page.waitForURL((url) => url.pathname.includes("/welcome"));
  await seeHeading(onboarding.page, "規約への同意");
  await onboarding.page.getByRole("button", { exact: true, name: "同意して続ける" }).click();
  await seeHeading(onboarding.page, "プロフィールの作り方");
  await onboarding.page.getByRole("button", { exact: true, name: "自分で入力する" }).click();
  await seeHeading(onboarding.page, "基本項目の入力");
  await onboarding.page
    .getByLabel("ユーザー名", { exact: true })
    .first()
    .fill(onboarding.account.name);
  await onboarding.page.getByRole("button", { exact: true, name: "保存してホームへ" }).click();
  await onboarding.page.waitForURL(`${onboarding.origin}/home`);
};

const verifyEmailAndSignIn = async (signup: {
  readonly account: Account;
  readonly mail: MailDelivery;
  readonly origin: string;
  readonly page: Page;
}): Promise<void> => {
  await seeHeading(signup.page, "確認メールを送りました");
  const verificationPrefix = `${signup.origin}/verify-email`;
  const link = await signup.mail.waitForLink(signup.account.email, verificationPrefix);
  await signup.page.goto(link);
  await signup.page.waitForURL(`${signup.origin}/login`);
  await signIn({ account: signup.account, origin: signup.origin, page: signup.page });
};

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

const finalizeVerifyMember = async (finalization: {
  readonly biography: string;
  readonly capture: ReturnType<typeof attachObservabilityCapture>;
  readonly origin: string;
  readonly page: Page;
}): Promise<VerifyMemberResult> => {
  await finalization.page.goto(`${finalization.origin}/settings/profile`);
  await seeText(finalization.page, finalization.biography);
  const session = await readSession(finalization.page, `${finalization.origin}/api/session`);
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
};

const secureMemberAccount = async (visit: {
  readonly account: Account;
  readonly origin: string;
  readonly page: Page;
}): Promise<{ readonly biography: string }> => {
  const { biography } = await updateProfile(visit);
  const enrollment = await enrollTotp(visit);
  await registerPasskey(visit, "verify passkey");
  const exerciseAuthenticationFactors = async (): Promise<void> => {
    await signOut(visit.page, visit.origin);
    await signIn({ account: visit.account, origin: visit.origin, page: visit.page });
    await answerTotpChallenge(visit.page, enrollment.uri);
    await visit.page.waitForURL(`${visit.origin}${homePattern}`, { timeout: appearanceTimeout });
    await signOut(visit.page, visit.origin);
    await signInWithPasskey({ account: visit.account, origin: visit.origin, page: visit.page });
  };
  await exerciseAuthenticationFactors();
  return { biography };
};

const runVerifyMember = async (settings: {
  readonly mail: MailDelivery;
  readonly origin: string;
  readonly page: Page;
}): Promise<VerifyMemberResult> => {
  const { mail, origin, page } = settings;
  const capture = attachObservabilityCapture(page);
  const account = newAccount("verify-member");
  await signUp({ account, origin, page });
  await verifyEmailAndSignIn({ account, mail, origin, page });
  await completeWelcomeOnboarding({ account, origin, page });
  const { biography } = await secureMemberAccount({ account, origin, page });
  return finalizeVerifyMember({ biography, capture, origin, page });
};

export { mailDelivery, runVerifyMember };
export type { MailDelivery, VerifyMemberResult };
