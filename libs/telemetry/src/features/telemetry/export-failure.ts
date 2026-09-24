import { markFailed } from "@repo/cli/exit-code";
import { Console, Effect } from "effect";

import { ENABLE_VARIABLE } from "./optional-setting.ts";

const reasonOf = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : JSON.stringify(thrown);

const reportExportFailure = (thrown: unknown): Effect.Effect<void> =>
  markFailed.pipe(
    Effect.andThen(
      Console.error(
        `${ENABLE_VARIABLE} asked for telemetry, but it could not be exported: ${reasonOf(thrown)}`,
      ),
    ),
  );

export { reportExportFailure };
