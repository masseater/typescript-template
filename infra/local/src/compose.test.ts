// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { dirname, join } from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { fileURLToPath } from "node:url";

import { mailpitPort } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { receiverPorts } from "./receiver.ts";

const MAILPIT_SMTP_PORT = 1025;

const published = /^\s+- "127\.0\.0\.1:(?<host>\d+):(?<container>\d+)"$/gmu;

const compose = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../compose.yaml"),
  "utf8",
);

describe("local services", () => {
  it("publish every loopback port the rest of the repository reads", () => {
    expect.hasAssertions();
    const ports = Array.from(
      compose.matchAll(published),
      ({ groups }) => `${groups?.["host"]}:${groups?.["container"]}`,
    );
    const expected = [
      `${receiverPorts.otlp}:${receiverPorts.otlp}`,
      `${receiverPorts.logs}:${receiverPorts.logs}`,
      `${receiverPorts.traces}:${receiverPorts.traces}`,
      `${mailpitPort}:${mailpitPort}`,
      `${MAILPIT_SMTP_PORT}:${MAILPIT_SMTP_PORT}`,
    ];
    expect(ports).toStrictEqual(expected);
  });
});
