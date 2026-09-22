import { Effect } from "effect";

import { failed, type JourneyFailure } from "./journey-failure.ts";
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

const readMailboxDeliveries = (
  mailboxHttpReply: Response,
  recipient: string,
): Effect.Effect<readonly MailboxDelivery[]> =>
  Effect.tryPromise(() => mailboxHttpReply.json()).pipe(
    Effect.map((mailboxJson) =>
      parseMailboxDeliveries(mailboxJson).filter(
        (mailboxDelivery) => mailboxDelivery.recipient === recipient,
      ),
    ),
    Effect.orElseSucceed(() => []),
  );

const fetchMailboxDeliveries = (
  fetchImpl: typeof fetch,
  deliveriesUrl: string,
  recipient: string,
): Effect.Effect<readonly MailboxDelivery[], JourneyFailure> =>
  Effect.gen(function* loadMailboxDeliveries() {
    const mailboxHttpReply = yield* Effect.tryPromise({
      catch: (cause) => failed("VERIFY_VERIFICATION_MAIL_NOT_DELIVERED", cause),
      try: (signal) => fetchImpl(deliveriesUrl, { signal }),
    });
    if (!mailboxHttpReply.ok) {
      return [];
    }
    return yield* readMailboxDeliveries(mailboxHttpReply, recipient);
  });

const waitForMailboxLink = (linkSearch: {
  readonly deliveriesUrl: string;
  readonly prefix: string;
  readonly recipient: string;
}): Effect.Effect<string, JourneyFailure> =>
  until({
    attempt: () =>
      fetchMailboxDeliveries(fetch, linkSearch.deliveriesUrl, linkSearch.recipient).pipe(
        Effect.map((mailboxDeliveries) =>
          mailboxDeliveries
            .flatMap((mailboxDelivery) =>
              [...mailboxDelivery.link.matchAll(mailLinkPattern)].map(([matched]) => matched),
            )
            .find((matched) => matched.startsWith(linkSearch.prefix)),
        ),
        Effect.orElseSucceed(() => undefined),
      ),
    deadline: deadlineIn(deliveryTimeout),
    reason: "VERIFY_VERIFICATION_MAIL_NOT_DELIVERED",
  });

export { waitForMailboxLink };
