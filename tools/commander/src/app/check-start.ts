#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import { createServer } from "node:net";

import { NodeServices } from "@effect/platform-node";
import { loopbackAddress } from "@repo/config";
import { reportFailed, runCli } from "@repo/config/cli";
import { Cause, Console, Effect, FileSystem, Schema } from "effect";
import { chromium } from "playwright";

import { serveCommander } from "./serve.ts";

import type { Page } from "playwright";

class StartCheckFailed extends Schema.TaggedError<StartCheckFailed>()("StartCheckFailed", {
  reason: Schema.String,
}) {}

const stepTimeout = 60_000;
const checkTimeout = "4 minutes";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const freePort = Effect.callback<number, StartCheckFailed>((resume) => {
  const probe = createServer();
  probe.once("error", (error) => {
    const failure = new StartCheckFailed({ reason: `no free port: ${describe(error)}` });
    resume(Effect.fail(failure));
  });
  probe.listen(0, loopbackAddress, () => {
    const address = probe.address();
    probe.close(() => {
      resume(
        typeof address === "object" && address !== null
          ? Effect.succeed(address.port)
          : Effect.fail(new StartCheckFailed({ reason: "no free port" })),
      );
    });
  });
});

const browserPage = Effect.gen(function* browserPage() {
  const browser = yield* Effect.acquireRelease(
    Effect.tryPromise({
      catch: (error) =>
        new StartCheckFailed({ reason: `browser did not start: ${describe(error)}` }),
      try: async () => chromium.launch(),
    }),
    (launched) => Effect.promise(async () => launched.close()),
  );
  return yield* Effect.promise(async () => browser.newPage());
});

function step(name: string, work: () => Promise<unknown>): Effect.Effect<void, StartCheckFailed> {
  return Effect.tryPromise({
    catch: (error) => new StartCheckFailed({ reason: `${name}: ${describe(error)}` }),
    try: work,
  }).pipe(Effect.asVoid);
}

function used(page: Page, origin: URL): Effect.Effect<readonly string[], StartCheckFailed> {
  return Effect.gen(function* using() {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        problems.push(`console error: ${message.text()}`);
      }
    });
    yield* step("the page did not load", async () => page.goto(origin.href));
    yield* step("the page did not render", async () =>
      page.getByRole("button", { name: "ここに作る" }).click({ timeout: stepTimeout }),
    );
    yield* step("the task list did not appear after creating the ledger", async () =>
      page.getByRole("heading", { name: "タスク" }).waitFor({ timeout: stepTimeout }),
    );
    return problems;
  });
}

function failed(reasons: readonly string[]): Readonly<Record<string, unknown>> {
  return { event: "quality.commander_start", ok: false, reasons };
}

const program = Effect.gen(function* program() {
  const files = yield* FileSystem.FileSystem;
  const directory = yield* files.makeTempDirectoryScoped({ prefix: "commander-start-" });
  const port = yield* freePort;
  const origin = yield* serveCommander({
    directory,
    model: undefined,
    port,
    stateDirectory: `${directory}/.state`,
  });
  const problems = yield* used(yield* browserPage, origin);
  yield* problems.length === 0
    ? Console.log(JSON.stringify({ event: "quality.commander_start", ok: true }))
    : reportFailed(failed(problems));
}).pipe(
  Effect.scoped,
  Effect.timeoutOrElse({
    duration: checkTimeout,
    orElse: () =>
      Effect.fail(new StartCheckFailed({ reason: `did not finish within ${checkTimeout}` })),
  }),
  Effect.provide(NodeServices.layer),
);

runCli(
  program.pipe(
    Effect.catchTag("StartCheckFailed", (failure) => reportFailed(failed([failure.reason]))),
  ),
  (cause) => failed([Cause.pretty(cause)]),
);
