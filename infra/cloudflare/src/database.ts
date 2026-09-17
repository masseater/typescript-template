import { RemovalPolicy, Stack } from "alchemy";
import { stackName, stackOptions } from "./stacks.ts";
import { D1 } from "alchemy/Cloudflare";
import { Effect } from "effect";
import { settings } from "./settings.ts";

const databaseResource = "Database";

const stack = Stack(
  stackName("database"),
  stackOptions,
  Effect.gen(function* database() {
    const config = yield* Effect.orDie(settings);
    const d1 = yield* D1.Database(databaseResource, { name: `${config.prefix}-db` }).pipe(
      RemovalPolicy.retain(),
    );
    return { databaseId: d1.databaseId, databaseName: d1.databaseName };
  }),
);

function databaseRef(): Effect.Effect<D1.Database> {
  return D1.Database.ref(databaseResource, { stack: stackName("database") });
}

// oxlint-disable-next-line import/no-default-export
export default stack;
export { databaseRef };
