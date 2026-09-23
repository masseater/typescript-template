import { NOTIFICATION_KIND } from "@repo/config";
import { withSpan } from "@repo/observability";
import { Effect, Schema } from "effect";

import { EmailDeliveryFailed } from "./email-delivery-failed.ts";

const mailSubjects = {
  contact: "お問い合わせ",
  emailChangeCompleted: "メールアドレスが変更されました",
  emailChangeNotice: "メールアドレスの変更が申請されました",
  emailChangeVerification: "新しいメールアドレスの確認",
  existingAccount: "このメールアドレスは登録済みです",
  invite: "アカウントへの招待",
  verification: "メールアドレスの確認",
} as const;

type OutboundEmail = {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: string;
};

const sendThroughMailpit = ({
  fetchImpl,
  mailpitSendUrl,
  outbound,
}: {
  readonly fetchImpl: typeof fetch;
  readonly mailpitSendUrl: string;
  readonly outbound: OutboundEmail;
}): Effect.Effect<void, EmailDeliveryFailed> =>
  Effect.gen(function* sendMailpit() {
    const requestPayload = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
      From: { Email: outbound.from },
      Subject: outbound.subject,
      Text: outbound.text,
      To: [{ Email: outbound.to }],
    }).pipe(Effect.mapError(() => new EmailDeliveryFailed({ reason: "unreachable" })));
    const delivery = yield* Effect.tryPromise({
      catch: () => new EmailDeliveryFailed({ reason: "unreachable" }),
      try: (signal) =>
        fetchImpl(mailpitSendUrl, {
          body: requestPayload,
          headers: { "content-type": "application/json" },
          method: "POST",
          redirect: "manual",
          signal,
        }),
    });
    if (!delivery.ok) {
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
    : sendThroughMailpit({
        fetchImpl: fetch,
        mailpitSendUrl: settings.MAILPIT_SEND_URL,
        outbound: addressed,
      });
};

type LinkedMail = {
  readonly email: string;
  readonly url: string;
};

const deliverLink = ({
  linked,
  settings,
  template,
}: {
  readonly linked: LinkedMail;
  readonly settings: MailSettings;
  readonly template: { readonly lead: string; readonly span: string; readonly subject: string };
}): Effect.Effect<void, EmailDeliveryFailed> => {
  if (URL.parse(linked.url)?.origin !== settings.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  return deliver(settings, {
    subject: template.subject,
    text: `${template.lead}\n${linked.url}`,
    to: linked.email,
  }).pipe(withSpan(template.span));
};

const notificationMailSubjects = {
  board: "掲示板の更新があります",
  conversationMessage: "新しいメッセージがあります",
} as const;

/** @internal */
export { mailSubjects, notificationMailSubjects };

export const sendVerificationEmail = (
  settings: MailSettings,
  verification: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink({
    linked: verification,
    settings,
    template: {
      lead: "次のリンクでメールアドレスを確認してください。",
      span: "email.verification",
      subject: mailSubjects.verification,
    },
  });

export const sendExistingAccountNotice = (
  settings: MailSettings,
  notice: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink({
    linked: notice,
    settings,
    template: {
      lead: "このメールアドレスで新規登録が試みられましたが、すでにアカウントがあります。次のリンクからログインしてください。心当たりがない場合は、このメールを破棄してください。",
      span: "email.existing_account_notice",
      subject: mailSubjects.existingAccount,
    },
  });

export const sendEmailChangeVerification = (
  settings: MailSettings,
  verification: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink({
    linked: verification,
    settings,
    template: {
      lead: "このメールアドレスへの変更が申請されました。次のリンクを開くと変更が確定します。心当たりがない場合は、このメールを破棄してください。",
      span: "email.email_change_verification",
      subject: mailSubjects.emailChangeVerification,
    },
  });

export const sendEmailChangeNotice = (
  settings: MailSettings,
  notice: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink({
    linked: notice,
    settings,
    template: {
      lead: "このアカウントのメールアドレスを変更する申請がありました。新しいメールアドレスに届いたリンクが開かれると、変更が確定します。心当たりがない場合は、次のリンクからセキュリティ設定を確認し、パスワードを変更してください。",
      span: "email.email_change_notice",
      subject: mailSubjects.emailChangeNotice,
    },
  });

export const sendContactEmail = (
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

export const sendEmailChangeCompleted = (
  settings: MailSettings,
  notice: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> =>
  deliverLink({
    linked: notice,
    settings,
    template: {
      lead: "このアカウントのメールアドレスの変更が確定しました。心当たりがない場合は、次のリンクからセキュリティ設定を確認してください。",
      span: "email.email_change_completed",
      subject: mailSubjects.emailChangeCompleted,
    },
  });

export const sendInviteEmail = (
  settings: MailSettings,
  invitation: LinkedMail,
): Effect.Effect<void, EmailDeliveryFailed> => {
  if (URL.parse(invitation.url)?.origin !== settings.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  return deliver(settings, {
    subject: mailSubjects.invite,
    text: `アカウントへ招待されました。次のリンクを開いてパスワードを設定してください。リンクは 7 日で無効になります。\n${invitation.url}`,
    to: invitation.email,
  }).pipe(withSpan("email.invite"));
};

export const sendNotificationEmail = (
  settings: MailSettings,
  outbound: Readonly<{
    readonly href: string;
    readonly kind:
      | typeof NOTIFICATION_KIND.boardPost
      | typeof NOTIFICATION_KIND.conversationMessage;
    readonly to: string;
  }>,
): Effect.Effect<void, EmailDeliveryFailed> => {
  const notificationUrl = new URL(outbound.href, settings.APP_ORIGIN).href;
  if (URL.parse(notificationUrl)?.origin !== settings.APP_ORIGIN) {
    return Effect.fail(new EmailDeliveryFailed({ reason: "origin_mismatch" }));
  }
  const subject =
    outbound.kind === NOTIFICATION_KIND.conversationMessage
      ? notificationMailSubjects.conversationMessage
      : notificationMailSubjects.board;
  return deliver(settings, {
    subject,
    text: `${subject}\n\n${notificationUrl}`,
    to: outbound.to,
  }).pipe(withSpan("email.notification"));
};

export type { LinkedMail, MailBinding, MailSettings };
