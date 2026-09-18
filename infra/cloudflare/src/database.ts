import { RemovalPolicy, Stack } from "alchemy";
import { D1 } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { databaseName } from "./database-lookup.ts";
import { settings } from "./settings.ts";
import { stackName, stackOptions } from "./stacks.ts";

const databaseResource = "Database";

const stack = Stack(
  stackName("database"),
  stackOptions,
  Effect.gen(function* database() {
    const config = yield* Effect.orDie(settings);
    const d1 = yield* D1.Database(databaseResource, { name: databaseName(config.prefix) }).pipe(
      RemovalPolicy.retain(),
    );
    return { databaseId: d1.databaseId, databaseName: d1.databaseName };
  }),
);

export default stack;
const databaseRef = (): Effect.Effect<D1.Database> => {
  return D1.Database.ref(databaseResource, { stack: stackName("database") });
};

export { databaseRef };
