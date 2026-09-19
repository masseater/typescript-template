// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, readFile, stat } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { applicationOrigins } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { replacePrivateFile } from "./private-files.ts";
import { appVariables, sharedRunnerCredentials } from "./shared-runner-credentials.ts";

async function privateFile(name: string): Promise<URL> {
  const base = await mkdtemp(path.join(tmpdir(), "private-files-"));
  return new URL(`file://${path.join(base, name)}`);
}

describe("replacing a private file", () => {
  it("leaves a file that already holds the content alone", async () => {
    expect.hasAssertions();
    const location = await privateFile("kept");
    await Effect.runPromise(replacePrivateFile(location, "same\n"));
    const written = await stat(location);
    await Effect.runPromise(replacePrivateFile(location, "same\n"));
    const revisited = await stat(location);
    expect(revisited.mtimeNs).toBe(written.mtimeNs);
    expect(await readFile(location, "utf-8")).toBe("same\n");
  });

  it("rewrites a file that holds different content", async () => {
    expect.hasAssertions();
    const location = await privateFile("replaced");
    await Effect.runPromise(replacePrivateFile(location, "before\n"));
    await Effect.runPromise(replacePrivateFile(location, "after\n"));
    expect(await readFile(location, "utf-8")).toBe("after\n");
  });
});

describe("the variables every runner shares", () => {
  it("derives one secret and keeps the origins off the network", () => {
    expect.hasAssertions();
    const credentials = sharedRunnerCredentials();
    expect(credentials).toStrictEqual(sharedRunnerCredentials());
    expect(appVariables("service-member", credentials, "loopback")).toMatchObject({
      APP_ORIGIN: applicationOrigins["service-member"],
      AUTH_SECRET: credentials.authSecret,
    });
  });
});
