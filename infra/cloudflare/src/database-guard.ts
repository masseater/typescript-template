import { Config, Effect, Redacted } from "effect";
import { State, listState } from "alchemy/State";
import { databaseName, findDatabaseId } from "./database-lookup.ts";
import { CloudflareFailure } from "./config.ts";
import type { DeploymentSecrets } from "./credentials.ts";
import type { SharedConfig } from "./config.ts";
import { State as StateRoute } from "alchemy/Alchemist";
import { stackName } from "./stacks.ts";
import { withVerifiedSecrets } from "./secrets.ts";

type DatabaseTarget = Pick<SharedConfig, "accountId" | "prefix">;

const apiToken = Config.redacted("CLOUDFLARE_API_TOKEN");

function nameTaken(): CloudflareFailure {
  return new CloudflareFailure({ code: "database_name_taken", keys: ["TEMPLATE_PREFIX"] });
}

const existingDatabaseId = Effect.fn("existingDatabaseId")(function* existingDatabaseId(
  secrets: DeploymentSecrets,
  target: DatabaseTarget,
) {
  const token = yield* withVerifiedSecrets(secrets, apiToken);
  return yield* findDatabaseId({
    accountId: target.accountId,
    apiToken: Redacted.value(token),
    name: databaseName(target.prefix),
  });
});

const assertDatabaseNameFree = Effect.fn("assertDatabaseNameFree")(function* assertDatabaseNameFree(
  secrets: DeploymentSecrets,
  target: DatabaseTarget,
) {
  if ((yield* existingDatabaseId(secrets, target)) !== undefined) {
    return yield* Effect.fail(nameTaken());
  }
});

const databaseInState = Effect.fn("databaseInState")(function* databaseInState(
  envFile: string,
  prefix: string,
) {
  const store = yield* StateRoute.store({ backend: "cloudflare", envFile });
  return yield* listState({ path: `${stackName("database")}/${prefix}`, recursive: true }).pipe(
    Effect.provideService(State, Effect.succeed(store)),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map((entries) => entries.length > 0),
    Effect.catchTag("InvalidStatePath", () => Effect.succeed(false)),
  );
});

const assertDatabaseUnclaimed = Effect.fn("assertDatabaseUnclaimed")(
  function* assertDatabaseUnclaimed(secrets: DeploymentSecrets, target: DatabaseTarget) {
    if ((yield* existingDatabaseId(secrets, target)) === undefined) {
      return;
    }
    if (yield* databaseInState(secrets.filename, target.prefix)) {
      return;
    }
    return yield* Effect.fail(nameTaken());
  },
);

export { assertDatabaseNameFree, assertDatabaseUnclaimed };
