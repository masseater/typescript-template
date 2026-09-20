import { NOTIFICATION_KIND } from "@repo/config";
import { withSpan } from "@repo/observability";
import { Effect } from "effect";

import { EmailDeliveryFailed } from "./email-delivery-failed.ts";

const mailSubjects = {
  contact: "お問い合わせ",
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
): Effect.Effect<void, EmailDeliveryFailed> => {
  return Effect.tryPromise({
    catch: () => new EmailDeliveryFailed({ reason: "unreachable" }),
    try: async (signal) =>
      fetch(mailpitSendUrl, {
        body: JSON.stringify({
          From: { Email: outbound.from },
          Subject: outbound.subject,
          Text: outbound.text,
          To: [{ Email: outbound.to }],
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(mailpitTimeoutMilliseconds)]),
      }),
  }).pipe(
    Effect.flatMap((delivery) =>
      delivery.ok ? Effect.void : Effect.fail(new EmailDeliveryFailed({ reason: "rejected" })),
    ),
  );
};

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
    try: async () => binding.send(outbound),
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

const sendVerificationEmail = (
  settings: MailSettings,
  verification: { readonly email: string; readonly url: string },
): Effect.Effect<void, EmailDeliveryFailed> => {
  if (URL.parse(verification.url)?.origin !== settings.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  return deliver(settings, {
    subject: mailSubjects.verification,
    text: `次のリンクでメールアドレスを確認してください。\n${verification.url}`,
    to: verification.email,
  }).pipe(withSpan("email.verification"));
};

const sendExistingAccountNotice = (
  settings: MailSettings,
  notice: { readonly email: string; readonly url: string },
): Effect.Effect<void, EmailDeliveryFailed> => {
  if (URL.parse(notice.url)?.origin !== settings.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  return deliver(settings, {
    subject: mailSubjects.existingAccount,
    text: `このメールアドレスで新規登録が試みられましたが、すでにアカウントがあります。次のリンクからログインしてください。心当たりがない場合は、このメールを破棄してください。\n${notice.url}`,
    to: notice.email,
  }).pipe(withSpan("email.existing_account_notice"));
};

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

const notificationMailSubjects = {
  board: "掲示板の更新があります",
  conversationMessage: "新しいメッセージがあります",
} as const;

const sendNotificationEmail = (
  settings: MailSettings,
  outbound: Readonly<{
    readonly href: string;
    readonly kind:
      | typeof NOTIFICATION_KIND.boardPost
      | typeof NOTIFICATION_KIND.conversationMessage;
    readonly to: string;
  }>,
): Effect.Effect<void, EmailDeliveryFailed> => {
  const url = new URL(outbound.href, settings.APP_ORIGIN).href;
  if (URL.parse(url)?.origin !== settings.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  const subject =
    outbound.kind === NOTIFICATION_KIND.conversationMessage
      ? notificationMailSubjects.conversationMessage
      : notificationMailSubjects.board;
  return deliver(settings, {
    subject,
    text: `${subject}\n\n${url}`,
    to: outbound.to,
  }).pipe(withSpan("email.notification"));
};

export { mailSubjects, notificationMailSubjects };
export {
  sendContactEmail,
  sendExistingAccountNotice,
  sendNotificationEmail,
  sendVerificationEmail,
};
export type { MailSettings };
