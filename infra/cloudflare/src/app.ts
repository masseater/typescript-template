import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import type { Application } from "@template/config";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { parseSharedConfig, validateAuthSecret } from "./config.ts";
import { loadArtifacts } from "./artifacts.ts";
import { archiveSourceMaps } from "./source-maps.ts";
import { deployWorker } from "./worker.ts";

export async function deployApplication(target: Application) {
  const config = new pulumi.Config();
  const shared = new pulumi.StackReference(config.require("sharedStack"));
  const rawSettings = await shared.getOutputDetails("applicationSettings");
  const settings = Effect.runSync(parseSharedConfig(rawSettings.value));
  const origin = settings.origins[target];
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const artifacts = await Effect.runPromise(
    loadArtifacts(repositoryRoot, target).pipe(
      Effect.tap((loaded) => archiveSourceMaps(repositoryRoot, target, loaded.release)),
    ),
  );
  const plaintext = {
    APP_ORIGIN: origin,
    APP_RELEASE: artifacts.release,
    EMAIL_FROM: settings.mailFrom,
  };
  const bindings: cloudflare.types.input.WorkerVersionBinding[] = [
    ...(target === "wiki" ? [{ type: "ai", name: "AI" }] : []),
    { type: "d1", name: "DB", id: shared.requireOutput("databaseId") },
    {
      type: "secret_text",
      name: "AUTH_SECRET",
      text: shared
        .requireOutput("authSecret")
        .apply((value: unknown) => Effect.runSync(validateAuthSecret(value))),
    },
    { type: "send_email", name: "EMAIL", allowedSenderAddresses: [settings.mailFrom] },
    ...Object.entries(plaintext).map(([name, text]) => ({ type: "plain_text", name, text })),
  ];
  const { worker, deployment } = deployWorker(target, {
    accountId: settings.accountId,
    name: `${settings.prefix}-${target}`,
    version: {
      mainModule: artifacts.mainModule,
      modules: artifacts.modules,
      assets: { directory: artifacts.clientDirectory, config: { runWorkerFirst: true } },
      bindings: [...bindings, { type: "assets", name: "ASSETS" }],
    },
  });
  const domain = new cloudflare.WorkersCustomDomain(
    `${target}-domain`,
    {
      accountId: settings.accountId,
      zoneId: settings.zoneId,
      service: worker.name,
      hostname: new URL(origin).hostname,
    },
    { dependsOn: [deployment] },
  );
  return {
    workerName: worker.name,
    origin: pulumi.interpolate`https://${domain.hostname}`,
  };
}
