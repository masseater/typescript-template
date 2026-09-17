import type { AppTarget, SharedConfig } from "./config.ts";
import { Config, StackReference, interpolate } from "@pulumi/pulumi";
import type { Output, OutputInstance } from "@pulumi/pulumi";
import {
  Worker,
  WorkerVersion,
  WorkersCustomDomain,
  WorkersDeployment,
  ZeroTrustAccessApplication,
} from "@pulumi/cloudflare";
import type { WorkerVersionArgs, types } from "@pulumi/cloudflare";
import { appPolicy, parseSharedConfig, validateAuthSecret } from "./config.ts";
import { archiveSourceMaps } from "./source-maps.ts";
import { loadArtifacts } from "./artifacts.ts";
import { workerObservability } from "./observability.ts";

const FULL_ROLLOUT_PERCENTAGE = 100;

type WorkerVersionBinding = types.input.WorkerVersionBinding;
type StringOutput = Readonly<OutputInstance<string>>;

interface Deployment {
  accessAudience: Output<string> | undefined;
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
  readonly accessAudience: StringOutput | undefined;
  readonly artifacts: Awaited<ReturnType<typeof loadArtifacts>>;
  readonly policy: ReturnType<typeof appPolicy>;
  readonly outputs: SharedOutputs;
  readonly settings: SharedConfig;
  readonly target: AppTarget;
  readonly workerId: StringOutput;
}

interface BindingSources {
  readonly accessAudience: StringOutput | undefined;
  readonly origin: string;
  readonly release: string;
  readonly settings: SharedConfig;
  readonly shared: SharedOutputs;
  readonly target: AppTarget;
}

function adminAccess(settings: SharedConfig, workerId: StringOutput): ZeroTrustAccessApplication {
  return new ZeroTrustAccessApplication("admin-access", {
    accountId: settings.accountId,
    destinations: [{ type: "worker", workerId }],
    httpOnlyCookieAttribute: true,
    name: `${settings.prefix}-admin-access`,
    policies: [
      {
        decision: "allow",
        includes: settings.adminEmails.map((email) => ({ email: { email } })),
        name: "named-admins",
        precedence: 1,
      },
    ],
    sessionDuration: "8h",
    type: "self_hosted",
  });
}

function authSecret(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("auth_secret_invalid");
  }
  return validateAuthSecret(value);
}

function stackString(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("shared_stack_output_invalid");
  }
  return value;
}

function targetBindings(sources: BindingSources): WorkerVersionBinding[] {
  if (sources.target === "wiki") {
    return [{ name: "AI", type: "ai" }];
  }
  return [
    { id: sources.shared.databaseId, name: "DB", type: "d1" },
    {
      name: "AUTH_SECRET",
      text: sources.shared.authSecret,
      type: "secret_text",
    },
    { allowedSenderAddresses: [sources.settings.mailFrom], name: "EMAIL", type: "send_email" },
  ];
}

function accessBindings(sources: BindingSources): WorkerVersionBinding[] {
  if (sources.accessAudience === undefined) {
    return [];
  }
  return [
    { name: "ACCESS_AUD", text: sources.accessAudience, type: "plain_text" },
    { name: "ACCESS_ISSUER", text: sources.settings.accessIssuer, type: "plain_text" },
  ];
}

function runtimeBindings(sources: BindingSources): WorkerVersionBinding[] {
  const plaintext = {
    APP_ORIGIN: sources.origin,
    APP_RELEASE: sources.release,
    ...(sources.target === "wiki" ? {} : { EMAIL_FROM: sources.settings.mailFrom }),
  };
  return [
    ...targetBindings(sources),
    ...Object.entries(plaintext).map(([name, text]: readonly [string, string]) => ({
      name,
      text,
      type: "plain_text",
    })),
    ...accessBindings(sources),
  ];
}

async function readSharedStack(): Promise<SharedStack> {
  const shared = new StackReference(new Config().require("sharedStack"));
  const rawSettings = await shared.getOutputDetails("applicationSettings");
  return {
    outputs: {
      authSecret: shared.requireOutput("authSecret").apply(authSecret),
      databaseId: shared.requireOutput("databaseId").apply(stackString),
    },
    settings: parseSharedConfig(rawSettings.value),
  };
}

function versionArgs(release: Release): WorkerVersionArgs {
  const bindings = runtimeBindings({
    accessAudience: release.accessAudience,
    origin: release.policy.origin,
    release: release.artifacts.release,
    settings: release.settings,
    shared: release.outputs,
    target: release.target,
  });
  return {
    accountId: release.settings.accountId,
    assets: { config: release.policy.assets, directory: release.artifacts.clientDirectory },
    bindings: [...bindings, { name: "ASSETS", type: "assets" }],
    compatibilityDate: "2026-09-16",
    compatibilityFlags: ["nodejs_compat"],
    mainModule: release.artifacts.mainModule,
    modules: [...release.artifacts.modules],
    workerId: release.workerId,
  };
}

async function loadReleaseArtifacts(target: AppTarget): Promise<Release["artifacts"]> {
  const repositoryRoot = `${import.meta.dirname}/../../..`;
  const artifacts = await loadArtifacts(repositoryRoot, target);
  await archiveSourceMaps({ release: artifacts.release, repositoryRoot, target });
  return artifacts;
}

async function deployApplication(target: AppTarget): Promise<Deployment> {
  const { outputs, settings } = await readSharedStack();
  const policy = appPolicy(settings, target);
  const artifacts = await loadReleaseArtifacts(target);
  const worker = new Worker(`${target}-worker`, {
    accountId: settings.accountId,
    name: policy.name,
    observability: workerObservability,
    subdomain: policy.subdomain,
  });
  const access = target === "admin" ? adminAccess(settings, worker.id) : undefined;
  const version = new WorkerVersion(
    `${target}-version`,
    versionArgs({
      accessAudience: access?.aud,
      artifacts,
      outputs,
      policy,
      settings,
      target,
      workerId: worker.id,
    }),
    { dependsOn: access ? [access] : [] },
  );
  const deployment = new WorkersDeployment(`${target}-deployment`, {
    accountId: settings.accountId,
    scriptName: worker.name,
    strategy: "percentage",
    versions: [{ percentage: FULL_ROLLOUT_PERCENTAGE, versionId: version.id }],
  });
  const domain = new WorkersCustomDomain(
    `${target}-domain`,
    {
      accountId: settings.accountId,
      hostname: new URL(policy.origin).hostname,
      service: worker.name,
      zoneId: settings.zoneId,
    },
    { dependsOn: [deployment, ...(access ? [access] : [])] },
  );
  return {
    accessAudience: access?.aud,
    origin: interpolate`https://${domain.hostname}`,
    workerName: worker.name,
  };
}

export { deployApplication };
