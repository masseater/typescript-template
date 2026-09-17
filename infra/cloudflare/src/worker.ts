import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as cloudflare from "@pulumi/cloudflare";
import { secret } from "@pulumi/pulumi";
import type { Input } from "@pulumi/pulumi";
import { workerCompatibility } from "@template/config/worker";
import { Effect } from "effect";
import { fail, io } from "./artifacts.ts";
import { workerSubdomain } from "./config.ts";
import { workerObservability } from "./observability.ts";

type VersionArgs = Omit<
  cloudflare.WorkerVersionArgs,
  "accountId" | "workerId" | "compatibilityDate" | "compatibilityFlags"
>;

export function deployWorker(
  resource: string,
  options: { accountId: string; name: string; version: VersionArgs },
) {
  const worker = new cloudflare.Worker(`${resource}-worker`, {
    accountId: options.accountId,
    name: options.name,
    subdomain: workerSubdomain,
    observability: workerObservability,
  });
  const version = new cloudflare.WorkerVersion(`${resource}-version`, {
    ...options.version,
    accountId: options.accountId,
    workerId: worker.id,
    compatibilityDate: workerCompatibility.date,
    compatibilityFlags: [...workerCompatibility.flags],
  });
  const deployment = new cloudflare.WorkersDeployment(`${resource}-deployment`, {
    accountId: options.accountId,
    scriptName: worker.name,
    strategy: "percentage",
    versions: [{ versionId: version.id, percentage: 100 }],
  });
  return { worker, deployment };
}

const accountToken = (
  resource: string,
  accountId: string,
  token: { name: string; binding: string; permission: Input<string> },
) => ({
  type: "secret_text",
  name: token.binding,
  text: secret(
    new cloudflare.AccountToken(
      `${resource}-token`,
      {
        accountId,
        name: token.name,
        policies: [
          {
            effect: "allow",
            permissionGroups: [{ id: token.permission }],
            resources: JSON.stringify({ [`com.cloudflare.api.account.${accountId}`]: "*" }),
          },
        ],
      },
      { additionalSecretOutputs: ["value"] },
    ).value,
  ),
});

export const deployMonitor = Effect.fn("deployMonitor")(function* (
  resource: "budget" | "error" | "health",
  options: {
    accountId: string;
    name: string;
    artifact: string;
    className: string;
    token?: { name: string; binding: string; permission: Input<string> };
    alert: { from: string; to: readonly string[] };
    variables: Record<string, string>;
    cron: string;
  },
) {
  const content = yield* io(() => readFile(options.artifact));
  if (content.length === 0) return yield* fail(`${resource}_worker_artifact_empty`);
  const { worker, deployment } = deployWorker(resource, {
    accountId: options.accountId,
    name: options.name,
    version: {
      mainModule: "index.js",
      modules: [
        {
          name: "index.js",
          contentType: "application/javascript+module",
          contentFile: options.artifact,
          contentSha256: createHash("sha256").update(content).digest("hex"),
        },
      ],
      migrations: { newTag: "v1", newSqliteClasses: [options.className] },
      bindings: [
        { type: "durable_object_namespace", name: "MONITOR", className: options.className },
        {
          type: "send_email",
          name: "EMAIL",
          allowedSenderAddresses: [options.alert.from],
          allowedDestinationAddresses: [...options.alert.to],
        },
        ...(options.token ? [accountToken(resource, options.accountId, options.token)] : []),
        ...Object.entries({
          ...options.variables,
          ALERT_FROM: options.alert.from,
          ALERT_TO: options.alert.to.join(","),
        }).map(([name, text]) => ({ type: "plain_text", name, text })),
      ],
    },
  });
  const schedule = new cloudflare.WorkersCronTrigger(
    `${resource}-schedule`,
    {
      accountId: options.accountId,
      scriptName: worker.name,
      schedules: [{ cron: options.cron }],
    },
    { dependsOn: [deployment] },
  );
  return { workerName: worker.name, scheduleId: schedule.id };
});
