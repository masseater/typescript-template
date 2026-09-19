import { once } from "node:events";
import { createServer } from "node:http";
import { text } from "node:stream/consumers";

import { Effect, Ref } from "effect";

import { freePort, loopback, loopbackOrigin } from "./ports.ts";
import { deadlineIn, until } from "./waiting.ts";

const accepted = 202;
const notFound = 404;
const deliveryTimeout = 60_000;
const sendPath = "/api/v1/send";

type MailSink = {
  readonly origin: string;
  readonly stop: () => Promise<void>;
  readonly waitForLink: (recipient: string, prefix: string) => Promise<string>;
};

const findLink = (search: {
  readonly deliveries: readonly string[];
  readonly prefix: string;
  readonly recipient: string;
}): readonly string[] => {
  const linkPattern = /https?:\/\/[^\s"'<>\\]+/gu;
  return search.deliveries
    .filter((delivery) => delivery.includes(search.recipient))
    .flatMap((delivery) => [...delivery.matchAll(linkPattern)].map(([link]) => link))
    .filter((link) => link.startsWith(search.prefix));
};

const startMailSink = async (): Promise<MailSink> => {
  const deliveries = Ref.makeUnsafe<readonly string[]>([]);
  const port = await freePort();
  const server = createServer((incoming, outgoing) => {
    Effect.runFork(
      Effect.promise(async () => {
        if (incoming.method !== "POST" || incoming.url !== sendPath) {
          outgoing.writeHead(notFound).end();
          return;
        }
        const delivered = await text(incoming);
        Effect.runSync(Ref.set(deliveries, [...Ref.getUnsafe(deliveries), delivered]));
        outgoing.writeHead(accepted, { "content-type": "application/json" }).end("{}");
      }),
    );
  });
  server.listen(port, loopback);
  await once(server, "listening");
  return {
    origin: loopbackOrigin(port),
    stop: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    },
    waitForLink: async (recipient: string, prefix: string) =>
      until({
        attempt: () => findLink({ deliveries: Ref.getUnsafe(deliveries), prefix, recipient }).at(0),
        deadline: deadlineIn(deliveryTimeout),
        reason: "E2E_VERIFICATION_MAIL_NOT_DELIVERED",
      }),
  };
};

export { startMailSink };
export type { MailSink };
