import { newAccount } from "./accounts.ts";
import { agentUserAgent } from "./agent-user-agent.ts";
import {
  answerTotpChallenge,
  confirmEmail,
  enrollTotp,
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
import { installVirtualAuthenticator } from "./passkey.ts";
import { seeHeading, seeText } from "./screens.ts";

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
      waitForLink: (recipient, prefix) => waitForMailboxLink(mailboxUrl, recipient, prefix),
    };
  }
  if (mailpitOrigin === undefined) {
    throw new Error("VERIFY_MAIL_DELIVERY_UNAVAILABLE");
  }
  return {
    mailpitOrigin,
    waitForLink: (recipient, prefix) => waitForMailpitLink(mailpitOrigin, recipient, prefix),
  };
};

const completeWelcomeOnboarding = async (
  page: Page,
  origin: string,
  account: ReturnType<typeof newAccount>,
): Promise<void> => {
  await page.waitForURL((url) => url.pathname.includes("/welcome"));
  await seeHeading(page, "規約への同意");
  await page.getByRole("button", { exact: true, name: "同意して続ける" }).click();
  await seeHeading(page, "プロフィールの作り方");
  await page.getByRole("button", { exact: true, name: "自分で入力する" }).click();
  await seeHeading(page, "基本項目の入力");
  await page.getByLabel("ユーザー名", { exact: true }).first().fill(account.name);
  await page.getByRole("button", { exact: true, name: "保存してホームへ" }).click();
  await page.waitForURL(`${origin}/home`);
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

const runVerifyMember = async (settings: {
  readonly mail: MailDelivery;
  readonly origin: string;
  readonly page: Page;
}): Promise<VerifyMemberResult> => {
  const { mail, origin, page } = settings;
  await installVirtualAuthenticator(page.context());
  const capture = attachObservabilityCapture(page);
  const account = newAccount("verify-member");
  await signUp({ account, origin, page });
  await seeHeading(page, "確認メールを送りました");
  const verificationPrefix = `${origin}/verify-email`;
  const link = await mail.waitForLink(account.email, verificationPrefix);
  await page.goto(link);
  await page.waitForURL(`${origin}/login`);
  await signIn({ account, origin, page });
  await completeWelcomeOnboarding(page, origin, account);
  const { biography } = await updateProfile({ account, origin, page });
  const enrollment = await enrollTotp({ account, origin, page });
  await registerPasskey({ account, origin, page }, "verify passkey");
  await signOut(page, origin);
  await signIn({ account, origin, page });
  await answerTotpChallenge(page, enrollment.uri);
  await signOut(page, origin);
  await signInWithPasskey({ account, origin, page });
  await page.goto(`${origin}/settings/profile`);
  await seeText(page, biography);
  const session = await readSession(page, origin);
  capture.stop();
  return {
    biography,
    enrolledTotp: true,
    passkeyRegistered: true,
    requestIds: capture.requestIds,
    sessionToken: session.sessionToken,
    traceIds: capture.traceIds,
    userAgent: agentUserAgent,
    userId: session.userId,
  };
};

export { mailDelivery, runVerifyMember };
export type { MailDelivery, VerifyMemberResult };
