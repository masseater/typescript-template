// oxlint-disable-next-line import/no-nodejs-modules
import { IncomingMessage, request } from "node:http";
// oxlint-disable-next-line import/no-nodejs-modules
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules
import { text } from "node:stream/consumers";

const localOrigin = "http://localhost:3002";
const websocketKeyBytes = 16;
const upgradeTimeout = 3000;

interface DevEndpoint {
  readonly authorization: string;
  readonly port: number;
}

interface HttpCall {
  readonly authorized: boolean;
  readonly headers?: Readonly<Record<string, string>>;
  readonly pathname: string;
}

interface HttpResult {
  readonly body: string;
  readonly headers: Readonly<IncomingMessage["headers"]>;
  readonly status: number;
}

interface UpgradeCall {
  readonly authorized: boolean;
  readonly origin: string | undefined;
  readonly protocol: string;
}

function incomingMessage(event: readonly unknown[]): IncomingMessage {
  const [message] = event;
  if (!(message instanceof IncomingMessage)) {
    throw new TypeError("HTTP_RESPONSE_REQUIRED");
  }
  return message;
}

function websocketKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(websocketKeyBytes));
  return btoa(String.fromCodePoint(...bytes));
}

async function fetchPath(endpoint: DevEndpoint, call: HttpCall): Promise<HttpResult> {
  const outgoing = request({
    headers: {
      host: new URL(localOrigin).host,
      ...(call.authorized ? { authorization: endpoint.authorization } : {}),
      ...call.headers,
    },
    host: "127.0.0.1",
    path: call.pathname,
    port: endpoint.port,
  });
  outgoing.end();
  const message = incomingMessage(await once(outgoing, "response"));
  return { body: await text(message), headers: message.headers, status: message.statusCode ?? 0 };
}

async function upgrade(
  endpoint: DevEndpoint,
  pathname: string,
  call: UpgradeCall,
): Promise<number> {
  const outgoing = request({
    headers: {
      connection: "Upgrade",
      host: new URL(localOrigin).host,
      "sec-websocket-key": websocketKey(),
      "sec-websocket-protocol": call.protocol,
      "sec-websocket-version": "13",
      upgrade: "websocket",
      ...(call.origin === undefined ? {} : { origin: call.origin }),
      ...(call.authorized ? { authorization: endpoint.authorization } : {}),
    },
    host: "127.0.0.1",
    path: pathname,
    port: endpoint.port,
  });
  outgoing.setTimeout(upgradeTimeout, () => {
    outgoing.destroy(new Error("WEBSOCKET_VERIFICATION_TIMEOUT"));
  });
  outgoing.end();
  const message = incomingMessage(
    await Promise.race([once(outgoing, "response"), once(outgoing, "upgrade")]),
  );
  message.resume();
  outgoing.destroy();
  return message.statusCode ?? 0;
}

async function websocketPath(endpoint: DevEndpoint): Promise<string> {
  const client = await fetchPath(endpoint, { authorized: true, pathname: "/@vite/client" });
  const { token = "" } = /const wsToken = "(?<token>[^"]+)"/u.exec(client.body)?.groups ?? {};
  if (token === "") {
    throw new Error("VITE_CLIENT_WEBSOCKET_TOKEN_REQUIRED");
  }
  return `/?token=${encodeURIComponent(token)}`;
}

export { fetchPath, localOrigin, upgrade, websocketPath };
export type { DevEndpoint, HttpCall, UpgradeCall };
