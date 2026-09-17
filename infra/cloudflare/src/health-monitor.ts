import { Worker, WorkerVersion, WorkersCronTrigger, WorkersDeployment } from "@pulumi/cloudflare";
import type { Output } from "@pulumi/pulumi";
import type { SharedConfig } from "./config.ts";
import { healthWorkerArtifact } from "@template/health-monitor/artifact";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
import type { types } from "@pulumi/cloudflare";
import { workerCompatibility } from "@template/config/worker";
import { workerObservability } from "./observability.ts";

interface HealthMonitorDeployment {
  readonly scheduleId: Output<string>;
  readonly workerName: Output<string>;
}

type HealthSettings = Readonly<
  Pick<
    SharedConfig,
    "accountId" | "adminOrigin" | "mailFrom" | "prefix" | "userOrigin" | "wikiOrigin"
  >
> & { readonly budget: Readonly<{ recipients: readonly string[] }> };

const FULL_ROLLOUT_PERCENTAGE = 100;

async function healthArtifactSha256(): Promise<string> {
  const content = await readFile(healthWorkerArtifact);
  if (content.length === 0) {
    throw new Error("health_worker_artifact_empty");
  }
  return Buffer.from(await crypto.subtle.digest("SHA-256", content)).toString("hex");
}

function healthBindings(settings: HealthSettings): types.input.WorkerVersionBinding[] {
  return [
    { className: "HealthMonitor", name: "MONITOR", type: "durable_object_namespace" },
    {
      allowedDestinationAddresses: [...settings.budget.recipients],
      allowedSenderAddresses: [settings.mailFrom],
      name: "EMAIL",
      type: "send_email",
    },
    ...Object.entries({
      ADMIN_ORIGIN: settings.adminOrigin,
      ALERT_FROM: settings.mailFrom,
      ALERT_TO: settings.budget.recipients.join(","),
      USER_ORIGIN: settings.userOrigin,
      WIKI_ORIGIN: settings.wikiOrigin,
    }).map(([name, text]: readonly [string, string]) => ({ name, text, type: "plain_text" })),
  ];
}

async function deployHealthMonitor(settings: HealthSettings): Promise<HealthMonitorDeployment> {
  const worker = new Worker("health-worker", {
    accountId: settings.accountId,
    name: `${settings.prefix}-health`,
    observability: workerObservability,
    subdomain: { enabled: false, previewsEnabled: false },
  });
  const version = new WorkerVersion("health-version", {
    accountId: settings.accountId,
    bindings: healthBindings(settings),
    compatibilityDate: workerCompatibility.date,
    compatibilityFlags: [...workerCompatibility.flags],
    mainModule: "index.js",
    migrations: { newSqliteClasses: ["HealthMonitor"], newTag: "v1" },
    modules: [
      {
        contentFile: healthWorkerArtifact,
        contentSha256: await healthArtifactSha256(),
        contentType: "application/javascript+module",
        name: "index.js",
      },
    ],
    workerId: worker.id,
  });
  const deployment = new WorkersDeployment("health-deployment", {
    accountId: settings.accountId,
    scriptName: worker.name,
    strategy: "percentage",
    versions: [{ percentage: FULL_ROLLOUT_PERCENTAGE, versionId: version.id }],
  });
  const schedule = new WorkersCronTrigger(
    "health-schedule",
    {
      accountId: settings.accountId,
      schedules: [{ cron: "37 * * * *" }],
      scriptName: worker.name,
    },
    { dependsOn: [deployment] },
  );
  return { scheduleId: schedule.id, workerName: worker.name };
}

export { deployHealthMonitor };
