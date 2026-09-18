import { assert, it } from "@effect/vitest";
import { loadRemoteMigrations } from "@repo/db/migrations";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";

import { mockServer } from "./account-fixture.ts";
import {
  FORBIDDEN_STATUS,
  access,
  account,
  accountHandlers,
  config,
  databaseId,
  deployedDatabases,
  deployedState,
  emptyState,
  migrationQuery,
  sendingRecords,
} from "./inspection-fixture.ts";
import { describeFailure } from "./secrets.ts";
import { assertStackReady } from "./stack-guards.ts";
import { sendingStacks, stackDependencies, traceDestinationStack } from "./stacks.ts";

const deployment = { access, config };
const applications = ["admin", "user", "wiki"] as const;
const withoutOtlp = { access, config: { ...config, otlp: undefined } };
const migrations = await Effect.runPromise(loadRemoteMigrations());
const declaredMigrations = migrations.length;
const unmigrated = 0;

it.effect("stops the onboarding unit on an account that already holds the sending domain", () =>
  Effect.gen(function* program() {
    yield* mockServer(...accountHandlers({ records: sendingRecords }));
    const failure = yield* assertStackReady("email", deployment, emptyState()).pipe(Effect.flip);
    assert.deepStrictEqual(describeFailure(failure, []), {
      code: "sending_domain_unavailable",
      keys: ["emailSending"],
    });
  }).pipe(Effect.scoped),
);

it.effect("stops the database unit on a name another project created", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      ...accountHandlers({ databases: [{ name: `${config.prefix}-db`, uuid: databaseId }] }),
    );
    const failure = yield* assertStackReady("database", deployment, emptyState()).pipe(Effect.flip);
    assert.deepStrictEqual(describeFailure(failure, []), {
      code: "database_name_taken",
      keys: ["TEMPLATE_PREFIX"],
    });
  }).pipe(Effect.scoped),
);

it.effect("reads nothing for the units that claim no account-wide name", () =>
  Effect.forEach(
    sendingStacks.filter((stack) => !applications.some((app) => app === stack)),
    (stack) =>
      assertStackReady(
        stack,
        deployment,
        Effect.die("no state store is consulted for a unit without a guard"),
      ),
  ),
);

it.effect("refuses an application before the unit that declares its trace destination ran", () =>
  Effect.forEach(applications, (stack) =>
    Effect.gen(function* program() {
      yield* mockServer(
        ...accountHandlers({ databases: deployedDatabases }),
        migrationQuery(declaredMigrations),
      );
      assert.include(stackDependencies(stack), traceDestinationStack);
      const failure = yield* assertStackReady(stack, deployment, emptyState()).pipe(Effect.flip);
      assert.deepStrictEqual(describeFailure(failure, []), {
        code: "trace_destination_not_applied",
        keys: [traceDestinationStack],
      });
      yield* assertStackReady(stack, deployment, deployedState());
    }).pipe(Effect.scoped),
  ),
);

it.effect("names the read as the reason when the migration history cannot be read", () =>
  Effect.forEach(applications, (stack) =>
    Effect.gen(function* program() {
      yield* mockServer(
        ...accountHandlers({ databases: deployedDatabases }),
        http.post(`${account}/d1/database/${databaseId}/query`, () =>
          HttpResponse.json({ error: "forbidden" }, { status: FORBIDDEN_STATUS }),
        ),
      );
      const failure = yield* assertStackReady(stack, deployment, deployedState()).pipe(Effect.flip);
      assert.deepStrictEqual(describeFailure(failure, []), {
        code: "database_migration_status_unreadable",
        keys: ["REMOTE_QUERY_FAILED"],
      });
    }).pipe(Effect.scoped),
  ),
);

it.effect("refuses an application whose database has migrations left to apply", () =>
  Effect.forEach(applications, (stack) =>
    Effect.gen(function* program() {
      yield* mockServer(
        ...accountHandlers({ databases: deployedDatabases }),
        migrationQuery(unmigrated),
      );
      const failure = yield* assertStackReady(stack, deployment, deployedState()).pipe(Effect.flip);
      assert.deepStrictEqual(describeFailure(failure, []), {
        code: "database_migrations_pending",
        keys: [String(unmigrated), String(declaredMigrations)],
      });
    }).pipe(Effect.scoped),
  ),
);

it.effect("lets an application run without the trace destination unit when OTLP is unset", () =>
  Effect.forEach(applications, (stack) =>
    Effect.gen(function* program() {
      yield* mockServer(
        ...accountHandlers({ databases: deployedDatabases }),
        migrationQuery(declaredMigrations),
      );
      yield* assertStackReady(
        stack,
        withoutOtlp,
        Effect.die("no state store is consulted when no destination is declared"),
      );
    }).pipe(Effect.scoped),
  ),
);
