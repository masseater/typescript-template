import path from "node:path";

import { cloudflareTest } from "@cloudflare/vitest-plugin";
import {
  jobsQueueBinding,
  jobsQueueName,
  jobsWorkflowBinding,
  jobsWorkflowClass,
  jobsWorkflowName,
} from "@repo/config";
import { workerCompatibility } from "@repo/config/worker";
import { localDatabase } from "@repo/db/local";
import { loadRemoteMigrations } from "@repo/db/migrations";
import { workerTests } from "@repo/dont-review-it";
import { monitorBinding } from "@repo/monitor";
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
        [mailRecorder]: "WorkerEntrypoint",
        [jobsWorkflowClass]: "WorkflowEntrypoint",
      },
      main: path.join(root, "libs/monitor/src/monitor-fixture.ts"),
      miniflare: {
        bindings: {
          ALERT_FROM: "monitor@example.test",
          ALERT_TO: "operator@example.test,oncall@example.test",
          TEST_MIGRATIONS: migrations,
        },
        compatibilityDate: workerCompatibility.date,
        compatibilityFlags: [...workerCompatibility.flags],
        d1Databases: { [localDatabase.binding]: localDatabase.database_id },
        durableObjects: { [monitorBinding]: { className: probeMonitor, useSQLite: true } },
        outboundService: (outbound: { readonly url: string }) =>
          Response.json({ blocked: outbound.url }, { status: 403 }),
        queueConsumers: {
          [jobsQueueName]: { maxBatchSize: 10, maxRetries: 3 },
        },
        queueProducers: { [jobsQueueBinding]: jobsQueueName },
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
    setupFiles: [path.join(root, "tools/dont-review-it/src/vitest/parsed-fields.ts")],
    testTimeout: 30_000,
  },
});
