import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import { assertDatabaseNameFree, assertDatabaseUnclaimed } from "./database-guard.ts";
import { describeFailure, reportCause } from "./secrets.ts";
import { Effect } from "effect";
import type { Scope } from "effect";
import type { SetupServer } from "msw/node";
import { layer } from "alchemy/Alchemist";
import { setupServer } from "msw/node";
import { verificationSettings } from "./verification-fixture.ts";

const OK_EXIT_CODE = 0;
const FAILED_EXIT_CODE = 1;

const target = { accountId: verificationSettings.accountId, prefix: verificationSettings.prefix };
const secrets = {
  contents: "CLOUDFLARE_API_TOKEN=guard-test-not-a-real-token\n",
  filename: "cloudflare.env",
};
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database`;
const databaseName = `${target.prefix}-db`;

function mockServer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ...handlers: Parameters<typeof setupServer>
): Effect.Effect<SetupServer, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(...handlers);
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (server) =>
      Effect.sync(() => {
        server.close();
      }),
  );
}

function recordedExitCode(): Effect.Effect<() => number, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const previous = process.exitCode;
      process.exitCode = OK_EXIT_CODE;
      return { observe: (): number => Number(process.exitCode), previous };
    }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (recorded) =>
      Effect.sync(() => {
        process.exitCode = recorded.previous;
      }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ).pipe(Effect.map((recorded) => recorded.observe));
}

const unusedName = http.get(endpoint, () => HttpResponse.json({ result: [], success: true }));
const takenName = http.get(endpoint, () =>
  HttpResponse.json({
    result: [{ name: databaseName, uuid: "92b705e4-7b3b-42a9-9de3-700a33fa609c" }],
    success: true,
  }),
);

it.effect("lets a first deploy through without reaching for the state store", () =>
  Effect.gen(function* program() {
    yield* mockServer(unusedName);
    assert.isUndefined(yield* assertDatabaseNameFree(secrets, target));
    assert.isUndefined(yield* assertDatabaseUnclaimed(secrets, target));
  }).pipe(Effect.provide(layer()), Effect.scoped),
);

it.effect("stops the account check with the key to change when the name is already taken", () =>
  Effect.gen(function* program() {
    yield* mockServer(takenName);
    const failure = yield* assertDatabaseNameFree(secrets, target).pipe(Effect.flip);
    assert.deepStrictEqual(describeFailure(failure), {
      code: "database_name_taken",
      keys: ["TEMPLATE_PREFIX"],
    });
  }).pipe(Effect.scoped),
);

it.effect("reports a taken name as a failed run rather than continuing", () =>
  Effect.gen(function* program() {
    yield* mockServer(takenName);
    const exitCode = yield* recordedExitCode();
    yield* assertDatabaseNameFree(secrets, target).pipe(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      Effect.catchCause((cause) => reportCause("account.rejected", cause)),
    );
    assert.strictEqual(exitCode(), FAILED_EXIT_CODE);
  }).pipe(Effect.scoped),
);
