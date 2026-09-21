import { deliveryTimeout, mailLinkPattern } from "./mail.ts";
import { deadlineIn, until } from "./waiting.ts";

type MailboxDelivery = {
  readonly link: string;
  readonly recipient: string;
};

const isMailboxDelivery = (candidate: unknown): candidate is MailboxDelivery => {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "link" in candidate &&
    "recipient" in candidate &&
    typeof candidate.link === "string" &&
    typeof candidate.recipient === "string"
  );
};

const parseMailboxDeliveries = (mailboxJson: unknown): readonly MailboxDelivery[] => {
  if (!Array.isArray(mailboxJson)) {
    return [];
  }
  return mailboxJson.filter(isMailboxDelivery);
};

const readMailboxDeliveries = async (
  mailboxHttpReply: Response,
  recipient: string,
): Promise<readonly MailboxDelivery[]> =>
  (async (): Promise<readonly MailboxDelivery[]> => {
    try {
      const mailboxJson = await mailboxHttpReply.json();
      const mailboxDeliveries = parseMailboxDeliveries(mailboxJson);
      return mailboxDeliveries.filter((mailboxDelivery) => mailboxDelivery.recipient === recipient);
    } catch (parseFailure) {
      if (parseFailure instanceof Error) {
        return [];
      }
      throw parseFailure;
    }
  })();

const fetchMailboxDeliveries = async (
  deliveriesUrl: string,
  recipient: string,
): Promise<readonly MailboxDelivery[]> => {
  const mailboxHttpReply = await fetch(deliveriesUrl);
  if (!mailboxHttpReply.ok) {
    return [];
  }
  return readMailboxDeliveries(mailboxHttpReply, recipient);
};

const waitForMailboxLink = async (linkSearch: {
  readonly deliveriesUrl: string;
  readonly prefix: string;
  readonly recipient: string;
}): Promise<string> => {
  const link = await until({
    attempt: async () => {
      const mailboxDeliveries = await fetchMailboxDeliveries(
        linkSearch.deliveriesUrl,
        linkSearch.recipient,
      );
      return mailboxDeliveries
        .flatMap((mailboxDelivery) =>
          [...mailboxDelivery.link.matchAll(mailLinkPattern)].map(([matched]) => matched),
        )
        .find((matched) => matched.startsWith(linkSearch.prefix));
    },
    deadline: deadlineIn(deliveryTimeout),
    reason: "VERIFY_VERIFICATION_MAIL_NOT_DELIVERED",
  });
  return link;
};

export { waitForMailboxLink };
