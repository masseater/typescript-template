import type { Input, Output } from "@pulumi/pulumi";
import { Worker, WorkerVersion, WorkersCronTrigger, WorkersDeployment } from "@pulumi/cloudflare";
import type { WorkerVersionArgs, types } from "@pulumi/cloudflare";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
import { secret } from "@pulumi/pulumi";
import { workerCompatibility } from "@template/config/worker";
import { workerObservability } from "./observability.ts";
import { workerSubdomain } from "./config.ts";

type VersionArgs = Omit<
  WorkerVersionArgs,
  "accountId" | "compatibilityDate" | "compatibilityFlags" | "workerId"
>;
type WorkerVersionBinding = types.input.WorkerVersionBinding;

interface WorkerDeployment {
  readonly deployment: WorkersDeployment;
  readonly worker: Worker;
}

interface WorkerOptions {
  readonly accountId: string;
  readonly name: string;
  readonly version: VersionArgs;
}

interface MonitorToken {
  readonly binding: string;
  readonly text: Input<string>;
}

interface MonitorOptions {
  readonly accountId: string;
  readonly alert: Readonly<{ from: string; to: readonly string[] }>;
  readonly artifact: string;
  readonly className: string;
  readonly cron: string;
  readonly name: string;
  readonly token?: MonitorToken;
  readonly variables: Readonly<Record<string, string>>;
}

interface MonitorDeployment {
  readonly scheduleId: Output<string>;
  readonly workerName: Output<string>;
}

const FULL_ROLLOUT_PERCENTAGE = 100;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function deployWorker(resource: string, options: WorkerOptions): WorkerDeployment {
  const worker = new Worker(`${resource}-worker`, {
    accountId: options.accountId,
    name: options.name,
    observability: workerObservability,
    subdomain: workerSubdomain,
  });
  const version = new WorkerVersion(`${resource}-version`, {
    ...options.version,
    accountId: options.accountId,
    compatibilityDate: workerCompatibility.date,
    compatibilityFlags: [...workerCompatibility.flags],
    workerId: worker.id,
  });
  const deployment = new WorkersDeployment(`${resource}-deployment`, {
    accountId: options.accountId,
    scriptName: worker.name,
    strategy: "percentage",
    versions: [{ percentage: FULL_ROLLOUT_PERCENTAGE, versionId: version.id }],
  });
  return { deployment, worker };
}

async function assertArtifact(resource: string, artifact: string): Promise<void> {
  const content = await readFile(artifact);
  if (content.length === 0) {
    throw new Error(`${resource}_worker_artifact_empty`);
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function tokenBindings(token: MonitorToken | undefined): WorkerVersionBinding[] {
  if (token === undefined) {
    return [];
  }
  return [{ name: token.binding, text: secret(token.text), type: "secret_text" }];
}

function monitorBindings(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  options: MonitorOptions,
): WorkerVersionBinding[] {
  const variables = {
    ...options.variables,
    ALERT_FROM: options.alert.from,
    ALERT_TO: options.alert.to.join(","),
  };
  return [
    { className: options.className, name: "MONITOR", type: "durable_object_namespace" },
    {
      allowedDestinationAddresses: [...options.alert.to],
      allowedSenderAddresses: [options.alert.from],
      name: "EMAIL",
      type: "send_email",
    },
    ...tokenBindings(options.token),
    ...Object.entries(variables).map(([name, text]: readonly [string, string]) => ({
      name,
      text,
      type: "plain_text",
    })),
  ];
}

async function deployMonitor(
  resource: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  options: MonitorOptions,
): Promise<MonitorDeployment> {
  await assertArtifact(resource, options.artifact);
  const { deployment, worker } = deployWorker(resource, {
    accountId: options.accountId,
    name: options.name,
    version: {
      bindings: monitorBindings(options),
      mainModule: "index.js",
      migrations: { newSqliteClasses: [options.className], newTag: "v1" },
      modules: [
        {
          contentFile: options.artifact,
          contentType: "application/javascript+module",
          name: "index.js",
        },
      ],
    },
  });
  const schedule = new WorkersCronTrigger(
    `${resource}-schedule`,
    { accountId: options.accountId, schedules: [{ cron: options.cron }], scriptName: worker.name },
    { dependsOn: [deployment] },
  );
  return { scheduleId: schedule.id, workerName: worker.name };
}

export { deployMonitor, deployWorker };
