import { DurableObject, Email, Worker } from "alchemy/Cloudflare";
import { fail, io } from "./artifact-io.ts";
import {
  traceDestination,
  workerCompatibilityOptions,
  workerObservability,
  workerSubdomain,
} from "./config.ts";
import { Effect } from "effect";
import type { SharedConfig } from "./config.ts";
import { monitorBinding } from "@template/monitor";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
import { settings } from "./settings.ts";

type MonitorResource = "budget" | "error" | "health";

const assertArtifact = Effect.fn("assertArtifact")(function* assertArtifact(
  resource: MonitorResource,
  artifact: string,
) {
  const content = yield* io(async () => readFile(artifact));
  if (content.length === 0) {
    return yield* fail(`${resource}_worker_artifact_empty`);
  }
});

const monitorProgram = Effect.fn("monitorProgram")(function* monitorProgram(
  resource: MonitorResource,
  options: {
    readonly artifact: string;
    readonly className: string;
    readonly cron: string;
    readonly name: string;
    readonly variables: (config: SharedConfig) => Effect.Effect<Readonly<Record<string, unknown>>>;
  },
) {
  const config: SharedConfig = yield* Effect.orDie(settings);
  yield* Effect.orDie(assertArtifact(resource, options.artifact));
  const email = yield* Email.SendEmail("Email", {
    allowedDestinationAddresses: [...config.budget.recipients],
    allowedSenderAddresses: [config.mailFrom],
  });
  const variables = yield* options.variables(config);
  const worker = yield* Worker("Worker", {
    bundle: false,
    compatibility: workerCompatibilityOptions,
    crons: [options.cron],
    env: {
      ALERT_FROM: config.mailFrom,
      ALERT_TO: config.budget.recipients.join(","),
      EMAIL: email,
      [monitorBinding]: DurableObject(monitorBinding, { className: options.className }),
      ...variables,
    },
    main: options.artifact,
    name: `${config.prefix}-${options.name}`,
    observability: workerObservability(
      config.observabilitySampling,
      traceDestination(config)?.name,
    ),
    workersDev: workerSubdomain,
  });
  return { crons: worker.crons, workerName: worker.workerName };
});

export { monitorProgram };
