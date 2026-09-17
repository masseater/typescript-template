import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { workerCompatibility } from "@template/config/worker";
import { fileURLToPath } from "node:url";
import { appPolicy, parseSharedConfig, validateAuthSecret } from "./config.ts";
import type { AppTarget } from "./config.ts";
import { loadArtifacts } from "./artifacts.ts";
import { archiveSourceMaps } from "./source-maps.ts";
import { workerObservability } from "./observability.ts";

export async function deployApplication(target: AppTarget) {
  const config = new pulumi.Config();
  const shared = new pulumi.StackReference(config.require("sharedStack"));
  const rawSettings = await shared.getOutputDetails("applicationSettings");
  const settings = parseSharedConfig(rawSettings.value);
  const policy = appPolicy(settings, target);
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const artifacts = await loadArtifacts(repositoryRoot, target);
  await archiveSourceMaps(repositoryRoot, target, artifacts.release);
  const worker = new cloudflare.Worker(`${target}-worker`, {
    accountId: settings.accountId,
    name: policy.name,
    subdomain: policy.subdomain,
    observability: workerObservability,
  });
  const plaintext = {
    APP_ORIGIN: policy.origin,
    APP_RELEASE: artifacts.release,
    EMAIL_FROM: settings.mailFrom,
  };
  const bindings: cloudflare.types.input.WorkerVersionBinding[] = [
    ...(target === "wiki" ? [{ type: "ai", name: "AI" }] : []),
    { type: "d1", name: "DB", id: shared.requireOutput("databaseId") },
    {
      type: "secret_text",
      name: "AUTH_SECRET",
      text: shared.requireOutput("authSecret").apply((value: unknown) => {
        if (typeof value !== "string") throw new Error("auth_secret_invalid");
        return validateAuthSecret(value);
      }),
    },
    { type: "send_email", name: "EMAIL", allowedSenderAddresses: [settings.mailFrom] },
    ...Object.entries(plaintext).map(([name, text]) => ({ type: "plain_text", name, text })),
  ];
  const version = new cloudflare.WorkerVersion(`${target}-version`, {
    accountId: settings.accountId,
    workerId: worker.id,
    compatibilityDate: workerCompatibility.date,
    compatibilityFlags: [...workerCompatibility.flags],
    mainModule: artifacts.mainModule,
    modules: artifacts.modules,
    assets: { directory: artifacts.clientDirectory, config: policy.assets },
    bindings: [...bindings, { type: "assets", name: "ASSETS" }],
  });
  const deployment = new cloudflare.WorkersDeployment(`${target}-deployment`, {
    accountId: settings.accountId,
    scriptName: worker.name,
    strategy: "percentage",
    versions: [{ versionId: version.id, percentage: 100 }],
  });
  const domain = new cloudflare.WorkersCustomDomain(
    `${target}-domain`,
    {
      accountId: settings.accountId,
      zoneId: settings.zoneId,
      service: worker.name,
      hostname: new URL(policy.origin).hostname,
    },
    { dependsOn: [deployment] },
  );
  return {
    workerName: worker.name,
    origin: pulumi.interpolate`https://${domain.hostname}`,
  };
}
