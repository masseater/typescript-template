import { Effect } from "effect";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineProject } from "vite-plus/test/config";
import { kCurrentWorker } from "miniflare";
import { localDatabase } from "@repo/db/local";
import { monitorBinding } from "@repo/monitor";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { workerCompatibility } from "@repo/config/worker";
import { workerMigrations } from "@repo/db/migrations";
import { workerTests } from "./test-runtime.ts";

const root = path.join(import.meta.dirname, "../..");
const mailRecorder = "MailRecorder";
const probeMonitor = "ProbeMonitor";

const migrations = await Effect.runPromise(Effect.orDie(workerMigrations()));

// oxlint-disable-next-line import/no-default-export
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
