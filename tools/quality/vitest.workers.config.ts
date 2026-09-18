import path from "node:path";

import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { workerCompatibility } from "@template/config/worker";
import { localDatabase } from "@template/db/local";
import { loadRemoteMigrations } from "@template/db/migrations";
import { monitorBinding } from "@template/monitor";
import { Effect } from "effect";
import { kCurrentWorker } from "miniflare";
import { defineProject } from "vite-plus/test/config";

import { workerTests } from "./test-runtime.ts";

const root = path.join(import.meta.dirname, "../..");
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
        outboundService: (request: { readonly url: string }) =>
          Response.json({ blocked: request.url }, { status: 403 }),
        serviceBindings: { EMAIL: { entrypoint: mailRecorder, name: kCurrentWorker } },
      },
    }),
  ],
  test: {
    include: [`libs/${workerTests}`, `infra/${workerTests}`],
    name: "workers",
    root,
    testTimeout: 30_000,
  },
});
