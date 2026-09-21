import { deliveryTimeout, mailLinkPattern } from "./mail.ts";
import { deadlineIn, until } from "./waiting.ts";

const findLink = (search: {
  readonly deliveries: readonly string[];
  readonly prefix: string;
  readonly recipient: string;
}): string | undefined => {
  return search.deliveries
    .filter((delivery) => delivery.includes(search.recipient))
    .flatMap((delivery) => [...delivery.matchAll(mailLinkPattern)].map(([link]) => link))
    .find((link) => link.startsWith(search.prefix));
};

const readMessage = async (messageUrl: string): Promise<string> => {
  const mailpitHttpReply = await fetch(messageUrl);
  if (!mailpitHttpReply.ok) {
    throw new Error("MAILPIT_MESSAGE_UNAVAILABLE");
  }
  const mailpitJson = (await mailpitHttpReply.json()) as { Text?: string };
  return mailpitJson.Text ?? "";
};

const searchInbox = async (
  searchUrl: string,
  messageUrl: (messageId: string) => string,
): Promise<readonly string[]> => {
  const mailpitHttpReply = await fetch(searchUrl);
  if (!mailpitHttpReply.ok) {
    return [];
  }
  const mailpitJson = (await mailpitHttpReply.json()) as {
    messages?: readonly { ID: string }[];
  };
  const inboxRows = mailpitJson.messages ?? [];
  return Promise.all(inboxRows.map((inboxRow) => readMessage(messageUrl(inboxRow.ID))));
};

const waitForMailpitLink = async (linkSearch: {
  readonly messageUrl: (messageId: string) => string;
  readonly prefix: string;
  readonly recipient: string;
  readonly searchUrl: string;
}): Promise<string> => {
  const link = await until({
    attempt: async () => {
      const deliveries = await searchInbox(linkSearch.searchUrl, linkSearch.messageUrl);
      return findLink({
        deliveries,
        prefix: linkSearch.prefix,
        recipient: linkSearch.recipient,
      });
    },
    deadline: deadlineIn(deliveryTimeout),
    reason: "VERIFY_VERIFICATION_MAIL_NOT_DELIVERED",
  });
  return link;
};

export { waitForMailpitLink };
