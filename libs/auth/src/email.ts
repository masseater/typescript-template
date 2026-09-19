import { withSpan } from "@repo/observability";
import { Effect } from "effect";

import { EmailDeliveryFailed } from "./email-delivery-failed.ts";

import type { SendEmail } from "@cloudflare/workers-types";

interface MailSettings {
  readonly EMAIL?: SendEmail;
  readonly EMAIL_FROM: string;
  readonly MAILPIT_URL?: string;
}

interface EmailMessage {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: string;
}

const mailSubjects = {
  contact: "お問い合わせ",
  existingAccount: "このメールアドレスは登録済みです",
  verification: "メールアドレスの確認",
} as const;

const mailpitTimeoutMilliseconds = 10_000;

function sendThroughMailpit(
  mailpit: string,
  email: EmailMessage,
): Effect.Effect<void, EmailDeliveryFailed> {
  return Effect.tryPromise({
    catch: (cause) => new EmailDeliveryFailed({ cause, reason: "unreachable" }),
    try: async (signal) =>
      fetch(`${mailpit}/api/v1/send`, {
        body: JSON.stringify({
          From: { Email: email.from },
          Subject: email.subject,
          Text: email.text,
          To: [{ Email: email.to }],
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(mailpitTimeoutMilliseconds)]),
      }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.void
        : Effect.fail(new EmailDeliveryFailed({ cause: response.status, reason: "rejected" })),
    ),
  );
}

function sendThroughBinding(
  binding: SendEmail | undefined,
  email: EmailMessage,
): Effect.Effect<void, EmailDeliveryFailed> {
  if (binding === undefined) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "unreachable" }));
  }
  return Effect.tryPromise({
    catch: (cause) => new EmailDeliveryFailed({ cause, reason: "rejected" }),
    try: async () => binding.send(email),
  }).pipe(Effect.asVoid);
}

function deliver(
  settings: MailSettings,
  email: Omit<EmailMessage, "from">,
): Effect.Effect<void, EmailDeliveryFailed> {
  const message: EmailMessage = { ...email, from: settings.EMAIL_FROM };
  return settings.MAILPIT_URL === undefined
    ? sendThroughBinding(settings.EMAIL, message)
    : sendThroughMailpit(settings.MAILPIT_URL, message);
}

function sendVerificationEmail(
  settings: MailSettings,
  to: string,
  url: string,
): Effect.Effect<void, EmailDeliveryFailed> {
  return deliver(settings, {
    subject: mailSubjects.verification,
    text: `次のリンクでメールアドレスを確認してください。\n${url}`,
    to,
  }).pipe(withSpan("email.verification"));
}

function sendExistingAccountNotice(
  settings: MailSettings,
  to: string,
  url: string,
): Effect.Effect<void, EmailDeliveryFailed> {
  return deliver(settings, {
    subject: mailSubjects.existingAccount,
    text: `このメールアドレスで新規登録が試みられましたが、すでにアカウントがあります。次のリンクからログインしてください。心当たりがない場合は、このメールを破棄してください。\n${url}`,
    to,
  }).pipe(withSpan("email.existing_account_notice"));
}

function sendContactEmail(
  settings: MailSettings,
  to: string,
  submission: Readonly<{ email: string; message: string; name: string }>,
): Effect.Effect<void, EmailDeliveryFailed> {
  return deliver(settings, {
    subject: mailSubjects.contact,
    text: `名前: ${submission.name}\nメール: ${submission.email}\n\n${submission.message}`,
    to,
  }).pipe(withSpan("email.contact"));
}

/** @internal */
export { mailSubjects };
export { sendContactEmail, sendExistingAccountNotice, sendVerificationEmail };
export type { MailSettings };
