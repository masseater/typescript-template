import { ApiToken, CloudflareEnvironment, Logpush, R2 } from "alchemy/Cloudflare";
import { all, map, mapEffect } from "alchemy/Output";
import { sha256 } from "alchemy/Util";
import { Effect, Redacted, pipe } from "effect";

import { APP_NAME } from "./app-name.ts";

const RETENTION_DAYS = 30;

const SECONDS_PER_DAY = 86_400;

const NORMAL_SAMPLE_RATE = 0.01;

const ARCHIVES = [
  {
    id: "WorkerFailures",
    prefix: "failures",
    filter: JSON.stringify({ where: { key: "Outcome", operator: "!eq", value: "ok" } }),
    sampleRate: 1,
  },
  { id: "WorkerSample", prefix: "sample", filter: "", sampleRate: NORMAL_SAMPLE_RATE },
] as const;

const FIELD_NAMES = [
  "EventTimestampMs",
  "EventType",
  "Event",
  "Outcome",
  "ScriptName",
  "Logs",
  "Exceptions",
];

const logsBucket = R2.Bucket("WorkerLogs", {
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

const writerToken = Effect.gen(function* writerToken() {
  const { accountId } = yield* yield* CloudflareEnvironment;
  return yield* ApiToken.AccountApiToken("WorkerLogsWriter", {
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
});

const logArchive = Effect.gen(function* logArchive() {
  const { accountId } = yield* yield* CloudflareEnvironment;
  const bucket = yield* logsBucket;
  const token = yield* writerToken;
  const credentials = all(token.tokenId, token.value, bucket.bucketName).pipe(
    mapEffect(([tokenId, value, bucketName]) =>
      sha256(Redacted.value(value)).pipe(
        Effect.map((secretAccessKey) => ({ tokenId, bucketName, secretAccessKey })),
      ),
    ),
  );
  return yield* pipe(
    ARCHIVES,
    Effect.forEach(({ id, prefix, filter, sampleRate }) =>
      Logpush.Job(id, {
        name: `${APP_NAME}-${prefix}-logs`,
        dataset: "workers_trace_events",
        destinationConf: credentials.pipe(
          map(
            ({ tokenId, bucketName, secretAccessKey }) =>
              `r2://${bucketName}/${prefix}/{DATE}?account-id=${accountId}&access-key-id=${tokenId}&secret-access-key=${secretAccessKey}`,
          ),
        ),
        enabled: true,
        filter,
        outputOptions: {
          fieldNames: FIELD_NAMES,
          outputType: "ndjson",
          sampleRate,
          timestampFormat: "rfc3339",
        },
      }),
    ),
  );
});

export { logArchive };
