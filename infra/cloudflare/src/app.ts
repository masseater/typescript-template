import type { Output, OutputInstance } from "@pulumi/pulumi";
import { consume, consumeSettings } from "./reference.ts";
import type { Application } from "@template/config";
import { Effect } from "effect";
import type { SharedConfig } from "./config.ts";
import { WorkersCustomDomain } from "@pulumi/cloudflare";
import { archiveSourceMaps } from "./source-maps.ts";
import { deployWorker } from "./worker.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { interpolate } from "@pulumi/pulumi";
import { loadArtifacts } from "./artifacts.ts";
import type { types } from "@pulumi/cloudflare";

type WorkerVersionBinding = types.input.WorkerVersionBinding;
type StringOutput = Readonly<OutputInstance<string>>;
type Artifacts = Effect.Success<ReturnType<typeof loadArtifacts>>;

interface Deployment {
  origin: Output<string>;
  workerName: Output<string>;
}

interface SharedOutputs {
  readonly authSecret: StringOutput;
  readonly databaseId: StringOutput;
}

interface Release {
  readonly artifacts: Artifacts;
  readonly origin: string;
  readonly outputs: SharedOutputs;
  readonly settings: SharedConfig;
  readonly target: Application;
}

function runtimeBindings(release: Release): WorkerVersionBinding[] {
  const plaintext = {
    APP_ORIGIN: release.origin,
    APP_RELEASE: release.artifacts.release,
    EMAIL_FROM: release.settings.mailFrom,
  };
  return [
    ...(release.target === "admin" ? [] : [{ name: "AI", type: "ai" }]),
    { id: release.outputs.databaseId, name: "DB", type: "d1" },
    { name: "AUTH_SECRET", text: release.outputs.authSecret, type: "secret_text" },
    { allowedSenderAddresses: [release.settings.mailFrom], name: "EMAIL", type: "send_email" },
    ...Object.entries(plaintext).map(([name, text]: readonly [string, string]) => ({
      name,
      text,
      type: "plain_text",
    })),
  ];
}

const readSharedStack = Effect.fn("readSharedStack")(function* readSharedStack(
  target: Application,
) {
  const { authSecret, settings } = yield* consumeSettings(target, "settings");
  const database = yield* consume(target, "database");
  const outputs: SharedOutputs = { authSecret, databaseId: database.text("databaseId") };
  return { outputs, settings };
});

function versionArgs(release: Release): Parameters<typeof deployWorker>[1]["version"] {
  return {
    assets: { config: { runWorkerFirst: true }, directory: release.artifacts.clientDirectory },
    bindings: [...runtimeBindings(release), { name: "ASSETS", type: "assets" }],
    mainModule: release.artifacts.mainModule,
    modules: [...release.artifacts.modules],
  };
}

const loadReleaseArtifacts = Effect.fn("loadReleaseArtifacts")(function* loadReleaseArtifacts(
  target: Application,
) {
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const artifacts = yield* loadArtifacts(repositoryRoot, target);
  yield* archiveSourceMaps(repositoryRoot, target, artifacts.release);
  return artifacts;
});

const deployApplication = Effect.fn("deployApplication")(function* deployApplication(
  target: Application,
) {
  const { outputs, settings } = yield* readSharedStack(target);
  const origin = settings.origins[target];
  const artifacts = yield* loadReleaseArtifacts(target);
  const { deployment, worker } = deployWorker(target, {
    accountId: settings.accountId,
    name: `${settings.prefix}-${target}`,
    version: versionArgs({ artifacts, origin, outputs, settings, target }),
  });
  const domain = new WorkersCustomDomain(
    `${target}-domain`,
    {
      accountId: settings.accountId,
      hostname: new URL(origin).hostname,
      service: worker.name,
      zoneId: settings.zoneId,
    },
    { dependsOn: [deployment] },
  );
  const deployed: Deployment = {
    origin: interpolate`https://${domain.hostname}`,
    workerName: worker.name,
  };
  return deployed;
});

export { deployApplication };
