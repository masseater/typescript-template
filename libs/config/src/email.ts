import type { SendEmail } from "@cloudflare/workers-types";
import { Effect } from "effect";

import { EmailDeliveryFailed } from "./email-delivery-failed.ts";

interface EmailSettings {
  readonly APP_ORIGIN: string;
  readonly EMAIL?: SendEmail;
  readonly EMAIL_FROM: string;
  readonly MAILPIT_URL?: string;
}

interface VerificationMessage {
  readonly email: string;
  readonly url: string;
}

interface EmailMessage {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: string;
}

const mailpitTimeoutMilliseconds = 10_000;

function sendThroughMailpit(
  mailpit: string,
  email: EmailMessage,
): Effect.Effect<void, EmailDeliveryFailed> {
  return Effect.tryPromise({
    catch: () => new EmailDeliveryFailed({ reason: "unreachable" }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.flatMap((response) =>
      response.ok ? Effect.void : Effect.fail(new EmailDeliveryFailed({ reason: "rejected" })),
    ),
  );
}

function sendThroughBinding(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  binding: SendEmail | undefined,
  email: EmailMessage,
): Effect.Effect<void, EmailDeliveryFailed> {
  if (binding === undefined) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "unreachable" }));
  }
  return Effect.tryPromise({
    catch: () => new EmailDeliveryFailed({ reason: "rejected" }),
    try: async () => binding.send(email),
  }).pipe(Effect.asVoid);
}

function sendVerificationEmail(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  config: EmailSettings,
  message: VerificationMessage,
): Effect.Effect<void, EmailDeliveryFailed> {
  if (URL.parse(message.url)?.origin !== config.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  const email: EmailMessage = {
    from: config.EMAIL_FROM,
    subject: "メールアドレスの確認",
    text: `次のリンクでメールアドレスを確認してください。\n${message.url}`,
    to: message.email,
  };
  return config.MAILPIT_URL === undefined
    ? sendThroughBinding(config.EMAIL, email)
    : sendThroughMailpit(config.MAILPIT_URL, email);
}

export { sendVerificationEmail };
