import { Effect } from "effect";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineProject } from "vite-plus/test/config";
import { kCurrentWorker } from "miniflare";
import { loadRemoteMigrations } from "@template/db/migrations";
import { localDatabase } from "@template/db/local";
import { monitorBinding } from "@template/monitor";
import { workerCompatibility } from "@template/config/worker";
import { workerTests } from "./test-runtime.ts";
import { workerdTelemetry } from "@template/perf/vitest";

const root = `${import.meta.dirname}/../..`;
const mailRecorder = "MailRecorder";
const probeMonitor = "ProbeMonitor";

const loaded = await Effect.runPromise(Effect.orDie(loadRemoteMigrations()));
const telemetry = await workerdTelemetry();
// oxlint-disable-next-line oxc/no-map-spread
const migrations = loaded.map((migration) => ({ ...migration, sql: [...migration.sql] }));

// oxlint-disable-next-line import/no-default-export
export default defineProject({
  plugins: [
    cloudflareTest({
      additionalExports: { [mailRecorder]: "WorkerEntrypoint" },
      main: `${root}/libs/monitor/src/monitor-fixture.ts`,
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
        outboundService: async (request: Readonly<Request>) =>
          telemetry.relay?.(request) ?? Response.json({ blocked: request.url }, { status: 403 }),
        serviceBindings: { EMAIL: { entrypoint: mailRecorder, name: kCurrentWorker } },
      },
    }),
  ],
  test: {
    experimental: { openTelemetry: telemetry.openTelemetry },
    include: [`libs/${workerTests}`, `infra/${workerTests}`],
    name: "workers",
    root,
    testTimeout: 30_000,
  },
});
