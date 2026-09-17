import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import type { Application } from "@template/config";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { loadArtifacts } from "./artifacts.ts";
import { archiveSourceMaps } from "./source-maps.ts";
import { consume, consumeSettings } from "./reference.ts";
import { deployWorker } from "./worker.ts";

export const deployApplication = Effect.fn("deployApplication")(function* (target: Application) {
  const { settings, authSecret } = yield* consumeSettings(target, "settings");
  const database = yield* consume(target, "database");
  const origin = settings.origins[target];
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const artifacts = yield* loadArtifacts(repositoryRoot, target);
  yield* archiveSourceMaps(repositoryRoot, target, artifacts.release);
  const plaintext = {
    APP_ORIGIN: origin,
    APP_RELEASE: artifacts.release,
    EMAIL_FROM: settings.mailFrom,
  };
  const bindings: cloudflare.types.input.WorkerVersionBinding[] = [
    ...(target === "wiki" ? [{ type: "ai", name: "AI" }] : []),
    { type: "d1", name: "DB", id: database.text("databaseId") },
    { type: "secret_text", name: "AUTH_SECRET", text: authSecret },
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
});
