import { Effect } from "effect";

import { EmailDeliveryFailed } from "./email-delivery-failed.ts";

import type { SendEmail } from "@cloudflare/workers-types";

type EmailMessage = {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: string;
};

const mailpitTimeoutMilliseconds = 10_000;

const sendThroughMailpit = (
  mailpitSendUrl: string,
  email: EmailMessage,
): Effect.Effect<void, EmailDeliveryFailed> => {
  return Effect.tryPromise({
    catch: () => new EmailDeliveryFailed({ reason: "unreachable" }),

    try: async (signal) =>
      fetch(mailpitSendUrl, {
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
    Effect.flatMap((delivery) =>
      delivery.ok ? Effect.void : Effect.fail(new EmailDeliveryFailed({ reason: "rejected" })),
    ),
  );
};

const sendThroughBinding = (
  binding: SendEmail | undefined,
  email: EmailMessage,
): Effect.Effect<void, EmailDeliveryFailed> => {
  if (binding === undefined) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "unreachable" }));
  }
  return Effect.tryPromise({
    catch: () => new EmailDeliveryFailed({ reason: "rejected" }),
    try: async () => binding.send(email),
  }).pipe(Effect.asVoid);
};

const sendVerificationEmail = (
  config: {
    readonly APP_ORIGIN: string;
    readonly EMAIL?: SendEmail;
    readonly EMAIL_FROM: string;
    readonly MAILPIT_SEND_URL?: string;
  },
  verification: { readonly email: string; readonly url: string },
): Effect.Effect<void, EmailDeliveryFailed> => {
  if (URL.parse(verification.url)?.origin !== config.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  const email: EmailMessage = {
    from: config.EMAIL_FROM,
    subject: "メールアドレスの確認",
    text: `次のリンクでメールアドレスを確認してください。\n${verification.url}`,
    to: verification.email,
  };
  return config.MAILPIT_SEND_URL === undefined
    ? sendThroughBinding(config.EMAIL, email)
    : sendThroughMailpit(config.MAILPIT_SEND_URL, email);
};

export { sendVerificationEmail };
