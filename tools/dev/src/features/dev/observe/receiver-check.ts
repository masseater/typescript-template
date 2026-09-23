#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { Console, Effect } from "effect";

import { exportedArrived, receiverFailureReason } from "./receiver.ts";

const EVENT = "quality.exported_telemetry";

runCli(
  exportedArrived().pipe(
    Effect.flatMap((arrival) =>
      Console.log(JSON.stringify({ event: EVENT, ok: true, ...arrival })),
    ),
  ),
  (cause) => ({ event: EVENT, ok: false, reason: receiverFailureReason(cause) }),
);
