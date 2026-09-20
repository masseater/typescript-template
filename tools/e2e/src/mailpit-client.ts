import { Schema } from "effect";

import { deliveryTimeout, mailLinkPattern } from "./mail.ts";
import { deadlineIn, until } from "./waiting.ts";

const MailpitMessage = Schema.Struct({
  ID: Schema.String,
  Subject: Schema.String,
  To: Schema.Array(Schema.Struct({ Address: Schema.String })),
});

const MailpitSearch = Schema.Struct({
  messages: Schema.Array(MailpitMessage),
});

const MailpitBody = Schema.Struct({
  Text: Schema.optionalKey(Schema.String),
});

const decodeMailpitSearch = Schema.decodeUnknownPromise(MailpitSearch);
const decodeMailpitBody = Schema.decodeUnknownPromise(MailpitBody);

const findLink = (search: {
  readonly messages: readonly string[];
  readonly prefix: string;
  readonly recipient: string;
}): string | undefined => {
  return search.messages
    .filter((message) => message.includes(search.recipient))
    .flatMap((message) => [...message.matchAll(mailLinkPattern)].map(([link]) => link))
    .find((link) => link.startsWith(search.prefix));
};

const readMessage = async (mailpitOrigin: string, messageId: string): Promise<string> => {
  const response = await fetch(`${mailpitOrigin}/api/v1/message/${messageId}`);
  if (!response.ok) {
    throw new Error("MAILPIT_MESSAGE_UNAVAILABLE");
  }
  const body = await decodeMailpitBody(await response.json());
  return body.Text ?? "";
};

const searchMessages = async (
  mailpitOrigin: string,
  recipient: string,
): Promise<readonly string[]> => {
  const response = await fetch(
    `${mailpitOrigin}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`,
  );
  if (!response.ok) {
    return [];
  }
  const search = await decodeMailpitSearch(await response.json());
  return Promise.all(search.messages.map((message) => readMessage(mailpitOrigin, message.ID)));
};

const waitForMailpitLink = async (
  mailpitOrigin: string,
  recipient: string,
  prefix: string,
): Promise<string> => {
  const link = await until({
    attempt: async () => {
      const messages = await searchMessages(mailpitOrigin, recipient);
      return findLink({ messages, prefix, recipient });
    },
    deadline: deadlineIn(deliveryTimeout),
    reason: "VERIFY_VERIFICATION_MAIL_NOT_DELIVERED",
  });
  return link;
};

export { waitForMailpitLink };
