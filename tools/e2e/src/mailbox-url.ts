import { Schema } from "effect";

import { deliveryTimeout, mailLinkPattern } from "./mail.ts";
import { deadlineIn, until } from "./waiting.ts";

const MailboxDelivery = Schema.Struct({
  link: Schema.String,
  recipient: Schema.String,
});

const MailboxDeliveries = Schema.Array(MailboxDelivery);

const decodeMailboxDeliveries = Schema.decodeUnknownPromise(MailboxDeliveries);

const mailboxDeliveries = async (
  mailboxUrl: string,
  recipient: string,
): Promise<readonly (typeof MailboxDelivery.Type)[]> => {
  const response = await fetch(
    `${mailboxUrl.replace(/\/$/u, "")}/messages?to=${encodeURIComponent(recipient)}`,
  );
  if (!response.ok) {
    return [];
  }
  const deliveries = await decodeMailboxDeliveries(await response.json()).catch(() => []);
  return deliveries.filter((delivery) => delivery.recipient === recipient);
};

const waitForMailboxLink = async (
  mailboxUrl: string,
  recipient: string,
  prefix: string,
): Promise<string> => {
  const link = await until({
    attempt: async () => {
      const deliveries = await mailboxDeliveries(mailboxUrl, recipient);
      return deliveries
        .flatMap((delivery) =>
          [...delivery.link.matchAll(mailLinkPattern)].map(([matched]) => matched),
        )
        .find((matched) => matched.startsWith(prefix));
    },
    deadline: deadlineIn(deliveryTimeout),
    reason: "VERIFY_VERIFICATION_MAIL_NOT_DELIVERED",
  });
  return link;
};

export { waitForMailboxLink };
