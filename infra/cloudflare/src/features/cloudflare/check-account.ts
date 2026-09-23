#!/usr/bin/env node
import { markFailed, runCli } from "@repo/cli";
import { Console, Effect } from "effect";

import {
  blocked,
  inspectAccount,
  preflightAccount,
  preflightBlocked,
} from "./account-inspection.ts";
import { layer } from "./alchemist.ts";
import { deploymentAccess, stateStore } from "./deployment-access.ts";
import { encodeJson } from "./platform.ts";
import { causeRecord, reportCause } from "./secrets.ts";

const EVENT = "account.rejected";

runCli(
  Effect.gen(function* program() {
    const { access, confidential, config, secrets } = yield* deploymentAccess();
    const preflight = yield* preflightAccount(access);
    const unready = preflightBlocked(preflight);
    if (unready.length > 0) {
      yield* Console.log(
        yield* encodeJson({
          blocked: unready,
          checks: preflight,
          event: "account.inspected",
          ok: false,
        }),
      );
      return yield* markFailed;
    }
    yield* Effect.gen(function* inspected() {
      const inspection = yield* inspectAccount(access, config, stateStore(secrets));
      const refused = blocked(inspection);
      yield* Console.log(
        yield* encodeJson({
          blocked: refused,
          checks: inspection,
          event: "account.inspected",
          ok: refused.length === 0,
        }),
      );
      if (refused.length > 0) {
        yield* markFailed;
      }
    }).pipe(
      Effect.provide(layer()),
      Effect.scoped,
      Effect.catchCause((cause) => reportCause(EVENT, cause, confidential)),
    );
  }),
  (cause) => causeRecord(EVENT, cause),
);
