import path from "node:path";

import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { workerCompatibility } from "@repo/config/worker";
import { localDatabase } from "@repo/db/local";
import { loadRemoteMigrations } from "@repo/db/migrations";
import { workerTests } from "@repo/dont-review-it/test-runtime";
import { monitorBinding } from "@repo/monitor";
import { Effect } from "effect";
import { kCurrentWorker } from "miniflare";
import { defineProject } from "vite-plus/test/config";

const root = import.meta.dirname;
const mailRecorder = "MailRecorder";
const probeMonitor = "ProbeMonitor";

const loaded = await Effect.runPromise(Effect.orDie(loadRemoteMigrations()));
const migrations = loaded.map((migration) => ({ ...migration, sql: [...migration.sql] }));

export default defineProject({
  plugins: [
    cloudflareTest({
      additionalExports: { [mailRecorder]: "WorkerEntrypoint" },
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
        serviceBindings: { EMAIL: { entrypoint: mailRecorder, name: kCurrentWorker } },
      },
    }),
  ],
  test: {
    include: [`libs/${workerTests}`, `infra/${workerTests}`, `apps/${workerTests}`],
    name: "workers",
    root,
    setupFiles: ["@repo/dont-review-it/vitest/parsed-fields"],
    testTimeout: 30_000,
  },
});
