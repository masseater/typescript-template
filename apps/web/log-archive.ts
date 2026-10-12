import { ApiToken, CloudflareEnvironment, Logpush, R2 } from "alchemy/Cloudflare";
import { all, mapEffect } from "alchemy/Output";
import { sha256 } from "alchemy/Util";
import { Effect, Redacted } from "effect";

import { APP_NAME } from "./app-name.ts";

const RETENTION_DAYS = 90;

const SECONDS_PER_DAY = 86_400;

const FIELD_NAMES = [
  "EventTimestampMs",
  "EventType",
  "Event",
  "Outcome",
  "ScriptName",
  "Logs",
  "Exceptions",
];

const logArchive = Effect.gen(function* logArchive() {
  const { accountId } = yield* yield* CloudflareEnvironment;
  const bucket = yield* R2.Bucket("WorkerLogs", {
    name: `${APP_NAME}-worker-logs`,
    lifecycleRules: [
      {
        id: "expire",
        deleteObjectsTransition: {
          condition: { type: "Age", maxAge: RETENTION_DAYS * SECONDS_PER_DAY },
        },
      },
    ],
  });
  const token = yield* ApiToken.AccountApiToken("WorkerLogsWriter", {
    name: `${APP_NAME}-worker-logs-writer`,
    accountId,
    policies: [
      {
        effect: "allow",
        permissionGroups: ["Workers R2 Storage Write"],
        resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
      },
    ],
  });
  const destinationConf = all(token.tokenId, token.value, bucket.bucketName).pipe(
    mapEffect(([tokenId, value, bucketName]) =>
      sha256(Redacted.value(value)).pipe(
        Effect.map(
          (secretAccessKey) =>
            `r2://${bucketName}/{DATE}?account-id=${accountId}&access-key-id=${tokenId}&secret-access-key=${secretAccessKey}`,
        ),
      ),
    ),
  );
  return yield* Logpush.Job("WorkerLogs", {
    name: `${APP_NAME}-worker-logs`,
    dataset: "workers_trace_events",
    destinationConf,
    enabled: true,
    outputOptions: { fieldNames: FIELD_NAMES, outputType: "ndjson", timestampFormat: "rfc3339" },
  });
});

export { logArchive };
