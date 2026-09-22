import { mailpitPort } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";

import { receiverPorts } from "./receiver.ts";

const MAILPIT_SMTP_PORT = 1025;

const published = /^\s+- "127\.0\.0\.1:(?<host>\d+):(?<container>\d+)"$/gmu;

const composeModules: Readonly<Record<string, string>> = import.meta.glob("../compose.yaml", {
  eager: true,
  import: "default",
});

const composeYaml = Object.values(composeModules)[0] ?? "";

const publishedPorts = Array.from(composeYaml.matchAll(published), ({ groups }) => {
  const host = groups?.host;
  const container = groups?.container;
  return `${host}:${container}`;
});

const expectedPublishedPorts = [
  `${receiverPorts.otlp}:${receiverPorts.otlp}`,
  `${receiverPorts.logs}:${receiverPorts.logs}`,
  `${receiverPorts.traces}:${receiverPorts.traces}`,
  `${mailpitPort}:${mailpitPort}`,
  `${MAILPIT_SMTP_PORT}:${MAILPIT_SMTP_PORT}`,
];

describe("local services", () => {
  const it = test.extend("publishedLoopbackPorts", () => publishedPorts);

  it("publish every loopback port the rest of the repository reads", ({
    publishedLoopbackPorts,
  }) => {
    expect(publishedLoopbackPorts).toStrictEqual(expectedPublishedPorts);
  });
});
