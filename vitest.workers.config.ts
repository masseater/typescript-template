import { cloudflareTest } from "@cloudflare/vitest-plugin";
import {
  jobsQueueBinding,
  jobsQueueName,
  jobsWorkflowBinding,
  jobsWorkflowClass,
  jobsWorkflowName,
} from "@repo/config";
import { userInboxBinding, userInboxClassName } from "@repo/config/realtime";
import { localCacheNamespace, localFileBucket } from "@repo/config/storage";
import { workerCompatibility } from "@repo/config/worker";
import { localDatabase } from "@repo/db/local";
import { loadRemoteMigrations } from "@repo/db/migrations";
import { workerTests } from "@repo/dont-review-it";
import { monitorBinding } from "@repo/monitor";
import { paths } from "@repo/vite-config";
import { Effect } from "effect";
import { kCurrentWorker } from "miniflare";
import { defineProject } from "vite-plus/test/config";

const root = import.meta.dirname;
const mailRecorder = "MailRecorder";
const probeMonitor = "ProbeMonitor";

const loaded = await Effect.runPromise(Effect.orDie(loadRemoteMigrations()));
const migrations = loaded.map((migration) => ({
  name: migration.name,
  queries: [...migration.sql],
}));

export default defineProject({
  plugins: [
    cloudflareTest({
      additionalExports: {
        [jobsWorkflowClass]: "WorkflowEntrypoint",
        [mailRecorder]: "WorkerEntrypoint",
      },
      main: paths.join(root, "vitest.workers.main.ts"),
      miniflare: {
        bindings: {
          ALERT_FROM: "monitor@example.test",
          ALERT_TO: "operator@example.test,oncall@example.test",
          TEST_MIGRATIONS: migrations,
        },
        compatibilityDate: workerCompatibility.date,
        compatibilityFlags: [...workerCompatibility.flags],
        d1Databases: { [localDatabase.binding]: localDatabase.database_id },
        durableObjects: {
          [monitorBinding]: { className: probeMonitor, useSQLite: true },
          [userInboxBinding]: { className: userInboxClassName, useSQLite: true },
        },
        kvNamespaces: { [localCacheNamespace.binding]: localCacheNamespace.id },
        outboundService: (outbound: { readonly url: string }) =>
          Response.json({ blocked: outbound.url }, { status: 403 }),
        queueConsumers: {
          [jobsQueueName]: { maxBatchSize: 10, maxRetries: 3 },
        },
        queueProducers: { [jobsQueueBinding]: jobsQueueName },
        r2Buckets: { [localFileBucket.binding]: localFileBucket.bucket_name },
        serviceBindings: { EMAIL: { entrypoint: mailRecorder, name: kCurrentWorker } },
        workflows: {
          [jobsWorkflowBinding]: {
            className: jobsWorkflowClass,
            name: jobsWorkflowName,
          },
        },
      },
    }),
  ],
  test: {
    include: [`libs/${workerTests}`, `infra/${workerTests}`, `apps/${workerTests}`],
    name: "workers",
    root,
    setupFiles: [paths.join(root, "tools/dont-review-it/src/vitest/parsed-fields.ts")],
    testTimeout: 30_000,
  },
});
