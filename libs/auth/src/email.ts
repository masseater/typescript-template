import { withSpan } from "@repo/observability";
import { Effect } from "effect";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";

import { EmailDeliveryFailed } from "./email-delivery-failed.ts";

const mailSubjects = {
  contact: "お問い合わせ",
  emailChangeNotice: "メールアドレスの変更が申請されました",
  emailChangeVerification: "新しいメールアドレスの確認",
  existingAccount: "このメールアドレスは登録済みです",
  verification: "メールアドレスの確認",
} as const;

const mailpitTimeoutMilliseconds = 10_000;

type OutboundEmail = {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: string;
};

const sendThroughMailpit = (
  mailpitSendUrl: string,
  outbound: OutboundEmail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  Effect.gen(function* sendMailpit() {
    const requestPayload = yield* HttpBody.json({
      From: { Email: outbound.from },
      Subject: outbound.subject,
      Text: outbound.text,
      To: [{ Email: outbound.to }],
    }).pipe(Effect.mapError(() => new EmailDeliveryFailed({ reason: "unreachable" })));
    const delivery = yield* HttpClient.post(mailpitSendUrl, {
      body: requestPayload,
      headers: { "content-type": "application/json" },
    }).pipe(
      Effect.timeout(`${mailpitTimeoutMilliseconds} millis`),
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
      Effect.mapError(() => new EmailDeliveryFailed({ reason: "unreachable" })),
    );
    if (delivery.status < 200 || delivery.status >= 300) {
      return yield* new EmailDeliveryFailed({ reason: "rejected" });
    }
  });

type MailBinding = {
  readonly send: (email: {
    readonly from: string;
    readonly subject: string;
    readonly text: string;
    readonly to: string;
  }) => Promise<unknown>;
};

const sendThroughBinding = (
  binding: MailBinding | undefined,
  outbound: OutboundEmail,
): Effect.Effect<void, EmailDeliveryFailed> => {
  if (binding === undefined) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "unreachable" }));
  }
  return Effect.tryPromise({
    catch: () => new EmailDeliveryFailed({ reason: "rejected" }),
    try: () => binding.send(outbound),
  }).pipe(Effect.asVoid);
};

type MailSettings = {
  readonly APP_ORIGIN: string;
  readonly EMAIL?: MailBinding;
  readonly EMAIL_FROM: string;
  readonly MAILPIT_SEND_URL?: string;
};

const deliver = (
  settings: MailSettings,
  outbound: Omit<OutboundEmail, "from">,
): Effect.Effect<void, EmailDeliveryFailed> => {
  const addressed: OutboundEmail = { ...outbound, from: settings.EMAIL_FROM };
  return settings.MAILPIT_SEND_URL === undefined
    ? sendThroughBinding(settings.EMAIL, addressed)
    : sendThroughMailpit(settings.MAILPIT_SEND_URL, addressed);
};

type LinkedMail = {
  readonly email: string;
  readonly url: string;
};

const deliverLink = (
  settings: MailSettings,
  linked: LinkedMail,
  template: { readonly lead: string; readonly span: string; readonly subject: string },
): Effect.Effect<void, EmailDeliveryFailed> => {
  if (URL.parse(linked.url)?.origin !== settings.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  return deliver(settings, {
    subject: template.subject,
    text: `${template.lead}\n${linked.url}`,
    to: linked.email,
  }).pipe(withSpan(template.span));
};

const sendVerificationEmail = (
  settings: MailSettings,
  verification: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink(settings, verification, {
    lead: "次のリンクでメールアドレスを確認してください。",
    span: "email.verification",
    subject: mailSubjects.verification,
  });

const sendExistingAccountNotice = (
  settings: MailSettings,
  notice: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink(settings, notice, {
    lead: "このメールアドレスで新規登録が試みられましたが、すでにアカウントがあります。次のリンクからログインしてください。心当たりがない場合は、このメールを破棄してください。",
    span: "email.existing_account_notice",
    subject: mailSubjects.existingAccount,
  });

const sendEmailChangeVerification = (
  settings: MailSettings,
  verification: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink(settings, verification, {
    lead: "このメールアドレスへの変更が申請されました。次のリンクを開くと変更が確定します。心当たりがない場合は、このメールを破棄してください。",
    span: "email.email_change_verification",
    subject: mailSubjects.emailChangeVerification,
  });

const sendEmailChangeNotice = (
  settings: MailSettings,
  notice: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink(settings, notice, {
    lead: "このアカウントのメールアドレスを変更する申請がありました。新しいメールアドレスに届いたリンクが開かれると、変更が確定します。心当たりがない場合は、次のリンクからセキュリティ設定を確認し、パスワードを変更してください。",
    span: "email.email_change_notice",
    subject: mailSubjects.emailChangeNotice,
  });

const sendContactEmail = (
  settings: MailSettings,
  outbound: Readonly<{
    readonly to: string;
    readonly submission: Readonly<{ email: string; message: string; name: string }>;
  }>,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliver(settings, {
    subject: mailSubjects.contact,
    text: `名前: ${outbound.submission.name}\nメール: ${outbound.submission.email}\n\n${outbound.submission.message}`,
    to: outbound.to,
  }).pipe(withSpan("email.contact"));

/** @internal */
export { mailSubjects };
export {
  sendContactEmail,
  sendEmailChangeNotice,
  sendEmailChangeVerification,
  sendExistingAccountNotice,
  sendVerificationEmail,
};
export type { MailSettings };
