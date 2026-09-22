import { Effect } from "effect";

import { failed, type JourneyFailure } from "./journey-failure.ts";
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

const readMessage = (
  fetchImpl: typeof fetch,
  messageUrl: string,
): Effect.Effect<string, JourneyFailure> =>
  Effect.gen(function* loadMailpitMessage() {
    const mailpitHttpReply = yield* Effect.tryPromise({
      catch: (cause) => failed("MAILPIT_MESSAGE_UNAVAILABLE", cause),
      try: (signal) => fetchImpl(messageUrl, { signal }),
    });
    if (!mailpitHttpReply.ok) {
      return yield* failed("MAILPIT_MESSAGE_UNAVAILABLE");
    }
    const mailpitJson = (yield* Effect.tryPromise({
      catch: (cause) => failed("MAILPIT_MESSAGE_UNAVAILABLE", cause),
      try: () => mailpitHttpReply.json(),
    })) as { Text?: string };
    return mailpitJson.Text ?? "";
  });

const searchInbox = (
  fetchImpl: typeof fetch,
  searchUrl: string,
  messageUrl: (messageId: string) => string,
): Effect.Effect<readonly string[], JourneyFailure> =>
  Effect.gen(function* loadMailpitInbox() {
    const mailpitHttpReply = yield* Effect.tryPromise({
      catch: (cause) => failed("VERIFY_VERIFICATION_MAIL_NOT_DELIVERED", cause),
      try: (signal) => fetchImpl(searchUrl, { signal }),
    });
    if (!mailpitHttpReply.ok) {
      return [];
    }
    const mailpitJson = (yield* Effect.tryPromise({
      catch: (cause) => failed("VERIFY_VERIFICATION_MAIL_NOT_DELIVERED", cause),
      try: () => mailpitHttpReply.json(),
    })) as {
      messages?: readonly { ID: string }[];
    };
    const inboxRows = mailpitJson.messages ?? [];
    return yield* Effect.forEach(inboxRows, (inboxRow) =>
      readMessage(fetchImpl, messageUrl(inboxRow.ID)),
    );
  });

const waitForMailpitLink = (linkSearch: {
  readonly messageUrl: (messageId: string) => string;
  readonly prefix: string;
  readonly recipient: string;
  readonly searchUrl: string;
}): Effect.Effect<string, JourneyFailure> =>
  until({
    attempt: () =>
      searchInbox(fetch, linkSearch.searchUrl, linkSearch.messageUrl).pipe(
        Effect.map((deliveries) =>
          findLink({
            deliveries,
            prefix: linkSearch.prefix,
            recipient: linkSearch.recipient,
          }),
        ),
        Effect.orElseSucceed(() => undefined),
      ),
    deadline: deadlineIn(deliveryTimeout),
    reason: "VERIFY_VERIFICATION_MAIL_NOT_DELIVERED",
  });

export { waitForMailpitLink };
