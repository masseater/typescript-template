import { randomUUID } from "node:crypto";
import { readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { respondedSuccessfully, waitUntilResponds } from "./responds.ts";

const refused = "connection refused";
const timedOut = "timed out";
const successAfterAttempts = 3;
const unavailableStatus = 503;

const probeCases = [
  ["a successful GET", "GET", 200, undefined, undefined, 200],
  ["an empty successful POST", "POST", 204, undefined, undefined, 204],
  ["a status that is not acceptable", "GET", unavailableStatus, undefined, undefined, unavailableStatus],
  ["a response that exceeds the timeout", "GET", "silent", 50, undefined, timedOut],
  ["retries until the target responds", "GET", "retry-until-ok", undefined, 2, "200:3"],
  ["retries that are exhausted", "GET", "retry-exhausted", undefined, 1, "503:2"],
] as const;

describe.for(probeCases)(
  "%s",
  ([, method, writeHead, timeoutMilliseconds, retryTimes, pinnedProbe]) => {
    const it = test.extend("observedProbe", async ({}, { onCleanup }) => {
      const attemptDirectory = await mkdtemp(path.join(tmpdir(), "responds-"));
      const server = createServer((_incoming, outgoing) => {
        if (writeHead === "silent") {
          return;
        }
        if (writeHead === "retry-until-ok" || writeHead === "retry-exhausted") {
          writeFileSync(path.join(attemptDirectory, randomUUID()), "");
        }
        const seenAttempts = readdirSync(attemptDirectory).length;
        const httpStatus =
          writeHead === "retry-until-ok"
            ? seenAttempts >= successAfterAttempts
              ? 200
              : unavailableStatus
            : writeHead === "retry-exhausted"
              ? unavailableStatus
              : writeHead;
        outgoing.writeHead(httpStatus);
        outgoing.end(httpStatus === 204 ? undefined : "ok");
      });
      onCleanup(async () => {
        await new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((closeFailure) => {
            if (closeFailure === undefined) {
              resolve();
              return;
            }
            reject(closeFailure);
          });
        });
        await rm(attemptDirectory, { force: true, recursive: true });
      });
      const url = await new Promise<string>((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          if (typeof address === "object" && address !== null) {
            resolve(`http://127.0.0.1:${address.port}/ready`);
            return;
          }
          reject(new Error("the probe server did not bind a port"));
        });
      });
      const program = waitUntilResponds<number | string>({
        accept: respondedSuccessfully,
        method,
        onStatus: (rejectedStatus) => rejectedStatus,
        onUnreachable: () => timedOut,
        ...(timeoutMilliseconds === undefined ? {} : { timeoutMilliseconds }),
        ...(retryTimes === undefined ? {} : { retry: { interval: "10 millis", times: retryTimes } }),
        url,
      });
      if (
        writeHead === unavailableStatus ||
        writeHead === "silent" ||
        writeHead === "retry-exhausted"
      ) {
        const failed = await Effect.runPromise(Effect.flip(program));
        return writeHead === "retry-exhausted"
          ? `${failed}:${readdirSync(attemptDirectory).length}`
          : failed;
      }
      const succeeded = await Effect.runPromise(program);
      return writeHead === "retry-until-ok"
        ? `${succeeded}:${readdirSync(attemptDirectory).length}`
        : succeeded;
    });

    it("reports what the probe observed", ({ observedProbe }) => {
      expect(observedProbe).toStrictEqual(pinnedProbe);
    });
  },
);

describe("a target that never accepts the connection", () => {
  const it = test.extend("unreachableName", async () => {
    const port = await new Promise<number>((resolve, reject) => {
      const server: Server = createServer();
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        server.close((closeFailure) => {
          if (closeFailure !== undefined) {
            reject(closeFailure);
            return;
          }
          if (typeof address === "object" && address !== null) {
            resolve(address.port);
            return;
          }
          reject(new Error(refused));
        });
      });
    });
    return Effect.runPromise(
      waitUntilResponds({
        accept: respondedSuccessfully,
        method: "GET",
        onStatus: () => refused,
        onUnreachable: (caught) => (caught instanceof Error ? caught.name : refused),
        url: `http://127.0.0.1:${port}/ready`,
      }).pipe(Effect.flip),
    );
  });

  it("names the failure instead of a response status", ({ unreachableName }) => {
    expect(unreachableName).toBe("TypeError");
  });
});

describe.for([
  [199, false],
  [200, true],
  [299, true],
  [300, false],
] as const)("HTTP %i", ([httpStatus, accepted]) => {
  const it = test.extend("successful", () => respondedSuccessfully(httpStatus));

  it("is a successful response status only from 200 up to 300", ({ successful }) => {
    expect(successful).toBe(accepted);
  });
});
