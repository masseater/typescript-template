import { once } from "node:events";
import { createServer } from "node:net";

const loopback = "127.0.0.1";

const freePort = async (): Promise<number> => {
  const probe = createServer();
  probe.listen(0, loopback);
  await once(probe, "listening");
  const address = probe.address();
  probe.close();
  await once(probe, "close");
  if (typeof address !== "object" || address === null) {
    throw new Error("E2E_PORT_UNAVAILABLE");
  }
  return address.port;
};

const loopbackOrigin = (port: number): string => {
  return `http://${loopback}:${port}`;
};

export { freePort, loopback, loopbackOrigin };
