// oxlint-disable-next-line import/no-nodejs-modules
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules
import { createServer } from "node:http";
// oxlint-disable-next-line import/no-nodejs-modules
import { text } from "node:stream/consumers";

import { freePort, loopback, loopbackOrigin } from "./ports.ts";
import { deadlineIn, until } from "./waiting.ts";

const accepted = 202;
const notFound = 404;
const deliveryTimeout = 60_000;
const sendPath = "/api/v1/send";
const linkPattern = /https?:\/\/[^\s"'<>\\]+/gu;

interface MailSink {
  readonly origin: string;
  readonly stop: () => Promise<void>;
  readonly waitForLink: (recipient: string, prefix: string) => Promise<string>;
}

function findLink(deliveries: readonly string[], recipient: string, prefix: string): string[] {
  return deliveries
    .filter((delivery) => delivery.includes(recipient))
    .flatMap((delivery) => [...delivery.matchAll(linkPattern)].map(([link]) => link))
    .filter((link) => link.startsWith(prefix));
}

async function startMailSink(): Promise<MailSink> {
  const deliveries: string[] = [];
  const port = await freePort();
  const server = createServer((request, response) => {
    async function receive(): Promise<void> {
      if (request.method !== "POST" || request.url !== sendPath) {
        response.writeHead(notFound).end();
        return;
      }
      deliveries.push(await text(request));
      response.writeHead(accepted, { "content-type": "application/json" }).end("{}");
    }
    void receive();
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
      until(
        () => findLink(deliveries, recipient, prefix).at(0),
        deadlineIn(deliveryTimeout),
        "E2E_VERIFICATION_MAIL_NOT_DELIVERED",
      ),
  };
}

export { startMailSink };
export type { MailSink };
