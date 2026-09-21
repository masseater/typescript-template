import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { mailpitPort } from "@repo/config";
import { Effect, FileSystem } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { receiverPorts } from "./receiver.ts";

const MAILPIT_SMTP_PORT = 1025;

const published = /^\s+- "127\.0\.0\.1:(?<host>\d+):(?<container>\d+)"$/gmu;

describe("local services", () => {
  it("publish every loopback port the rest of the repository reads", () =>
    Effect.runPromise(
      Effect.gen(function* readPublishedPorts() {
        const filesystem = yield* FileSystem.FileSystem;
        const compose = yield* filesystem.readFileString(
          fileURLToPath(new URL("../compose.yaml", import.meta.url)),
        );
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
        expect.hasAssertions();
        expect(ports).toStrictEqual(expected);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});
