import type { Output, OutputInstance } from "@pulumi/pulumi";
import { consume, consumeSettings } from "./reference.ts";
import type { Application } from "@template/config";
import type { SharedConfig } from "./config.ts";
import { WorkersCustomDomain } from "@pulumi/cloudflare";
import { archiveSourceMaps } from "./source-maps.ts";
import { deployWorker } from "./worker.ts";
import { interpolate } from "@pulumi/pulumi";
import { loadArtifacts } from "./artifacts.ts";
import type { types } from "@pulumi/cloudflare";

type WorkerVersionBinding = types.input.WorkerVersionBinding;
type StringOutput = Readonly<OutputInstance<string>>;

interface Deployment {
  origin: Output<string>;
  workerName: Output<string>;
}

interface SharedOutputs {
  readonly authSecret: StringOutput;
  readonly databaseId: StringOutput;
}

interface SharedStack {
  readonly outputs: SharedOutputs;
  readonly settings: SharedConfig;
}

interface Release {
  readonly artifacts: Awaited<ReturnType<typeof loadArtifacts>>;
  readonly origin: string;
  readonly outputs: SharedOutputs;
  readonly settings: SharedConfig;
  readonly target: Application;
}

interface BindingSources {
  readonly origin: string;
  readonly release: string;
  readonly settings: SharedConfig;
  readonly shared: SharedOutputs;
  readonly target: Application;
}

function runtimeBindings(sources: BindingSources): WorkerVersionBinding[] {
  const plaintext = {
    APP_ORIGIN: sources.origin,
    APP_RELEASE: sources.release,
    EMAIL_FROM: sources.settings.mailFrom,
  };
  return [
    ...(sources.target === "wiki" ? [{ name: "AI", type: "ai" }] : []),
    { id: sources.shared.databaseId, name: "DB", type: "d1" },
    { name: "AUTH_SECRET", text: sources.shared.authSecret, type: "secret_text" },
    { allowedSenderAddresses: [sources.settings.mailFrom], name: "EMAIL", type: "send_email" },
    ...Object.entries(plaintext).map(([name, text]: readonly [string, string]) => ({
      name,
      text,
      type: "plain_text",
    })),
  ];
}

async function readSharedStack(target: Application): Promise<SharedStack> {
  const { authSecret, settings } = await consumeSettings(target, "settings");
  const database = consume(target, "database");
  return { outputs: { authSecret, databaseId: database.text("databaseId") }, settings };
}

function versionArgs(release: Release): Parameters<typeof deployWorker>[1]["version"] {
  const bindings = runtimeBindings({
    origin: release.origin,
    release: release.artifacts.release,
    settings: release.settings,
    shared: release.outputs,
    target: release.target,
  });
  return {
    assets: { config: { runWorkerFirst: true }, directory: release.artifacts.clientDirectory },
    bindings: [...bindings, { name: "ASSETS", type: "assets" }],
    mainModule: release.artifacts.mainModule,
    modules: [...release.artifacts.modules],
  };
}

async function loadReleaseArtifacts(target: Application): Promise<Release["artifacts"]> {
  const repositoryRoot = `${import.meta.dirname}/../../..`;
  const artifacts = await loadArtifacts(repositoryRoot, target);
  await archiveSourceMaps({ release: artifacts.release, repositoryRoot, target });
  return artifacts;
}

async function deployApplication(target: Application): Promise<Deployment> {
  const { outputs, settings } = await readSharedStack(target);
  const origin = settings.origins[target];
  const artifacts = await loadReleaseArtifacts(target);
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
  return {
    origin: interpolate`https://${domain.hostname}`,
    workerName: worker.name,
  };
}

export { deployApplication };
