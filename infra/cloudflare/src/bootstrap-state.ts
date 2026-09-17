import { Effect, Schema } from "effect";
import { OK_EXIT_CODE, reportCause } from "./secrets.ts";
import { secretsStoreCount, stateStorePresent } from "./account-lookup.ts";
import type { AccountAccess } from "./account-read.ts";
import { CloudflareFailure } from "./config.ts";
import { NodeRuntime } from "@effect/platform-node";
import { deploymentAccess } from "./deployment-access.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";

const FAILED_EXIT_CODE = 1;
const ADOPT_FLAG = "--adopt-account-state";
const EVENT = "cloudflare.state_store_rejected";

class AlchemyFailure extends Schema.TaggedError<AlchemyFailure>()("AlchemyFailure", {
  code: Schema.Literal("alchemy_command_failed"),
}) {}

const alchemyBinary = fileURLToPath(new URL("../node_modules/.bin/alchemy", import.meta.url));

const assertAccountUnused = Effect.fn("assertAccountUnused")(function* assertAccountUnused(
  access: AccountAccess,
) {
  if (yield* stateStorePresent(access)) {
    return yield* Effect.fail(
      new CloudflareFailure({ code: "state_store_name_taken", keys: [ADOPT_FLAG] }),
    );
  }
  if ((yield* secretsStoreCount(access)) > 0) {
    return yield* Effect.fail(
      new CloudflareFailure({ code: "secrets_store_already_present", keys: [ADOPT_FLAG] }),
    );
  }
});

function runBootstrap(envFile: string): Effect.Effect<number, AlchemyFailure> {
  return Effect.callback<number, AlchemyFailure>((resume) => {
    const child = spawn(
      alchemyBinary,
      ["provider", "cloudflare", "bootstrap", "--env-file", envFile],
      {
        // oxlint-disable-next-line node/no-process-env
        env: { ...process.env, ALCHEMY_TELEMETRY_DISABLED: "1" },
        shell: false,
        stdio: "inherit",
      },
    );
    child.on("error", () => {
      resume(Effect.fail(new AlchemyFailure({ code: "alchemy_command_failed" })));
    });
    child.on("exit", (code) => {
      resume(Effect.succeed(code ?? FAILED_EXIT_CODE));
    });
  });
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const adopting = process.argv.includes(ADOPT_FLAG);
    const { access, confidential, secrets } = yield* deploymentAccess();
    yield* Effect.gen(function* bootstrap() {
      if (!adopting) {
        yield* assertAccountUnused(access);
      }
      if ((yield* runBootstrap(secrets.filename)) !== OK_EXIT_CODE) {
        return yield* Effect.fail(new AlchemyFailure({ code: "alchemy_command_failed" }));
      }
      // oxlint-disable-next-line no-console
      console.info(JSON.stringify({ adopted: adopting, event: "cloudflare.state_store_ready" }));
    }).pipe(
      Effect.catchCause(
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
        (cause) => reportCause(EVENT, cause, confidential),
      ),
    );
  }).pipe(
    Effect.catchCause(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (cause) => reportCause(EVENT, cause),
    ),
  ),
  { disableErrorReporting: true },
);
