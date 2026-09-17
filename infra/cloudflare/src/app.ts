import type { AppTarget, SharedConfig } from "./config.ts";
import { Config, StackReference, interpolate } from "@pulumi/pulumi";
import {
  Worker,
  WorkerVersion,
  WorkersCustomDomain,
  WorkersDeployment,
  ZeroTrustAccessApplication,
} from "@pulumi/cloudflare";
import type { WorkerVersionArgs, types } from "@pulumi/cloudflare";
import {
  appPolicy,
  parseSharedConfig,
  sentryRuntimeBindings,
  validateAuthSecret,
} from "./config.ts";
import type { Output } from "@pulumi/pulumi";
import { fileURLToPath } from "node:url";
import { loadArtifacts } from "./artifacts.ts";
import { workerObservability } from "./observability.ts";

const FULL_ROLLOUT_PERCENTAGE = 100;

type WorkerVersionBinding = types.input.WorkerVersionBinding;

interface Deployment {
  accessAudience: Output<string> | undefined;
  origin: Output<string>;
  workerName: Output<string>;
}

interface SharedOutputs {
  readonly authSecret: Output<string>;
  readonly databaseId: Output<string>;
  readonly otelHeaders: Output<string>;
}

interface SharedStack {
  readonly outputs: SharedOutputs;
  readonly settings: SharedConfig;
}

interface Release {
  readonly accessAudience: Output<string> | undefined;
  readonly artifacts: Awaited<ReturnType<typeof loadArtifacts>>;
  readonly policy: ReturnType<typeof appPolicy>;
  readonly outputs: SharedOutputs;
  readonly settings: SharedConfig;
  readonly target: AppTarget;
  readonly workerId: Output<string>;
}

interface BindingSources {
  readonly accessAudience: Output<string> | undefined;
  readonly origin: string;
  readonly settings: SharedConfig;
  readonly shared: SharedOutputs;
  readonly target: AppTarget;
}

function adminAccess(settings: SharedConfig, worker: Worker): ZeroTrustAccessApplication {
  return new ZeroTrustAccessApplication("admin-access", {
    accountId: settings.accountId,
    destinations: [{ type: "worker", workerId: worker.id }],
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
    OTEL_EXPORTER_OTLP_ENDPOINT: sources.settings.otelEndpoint,
    ...(sources.target === "wiki" ? {} : { EMAIL_FROM: sources.settings.mailFrom }),
  };
  return [
    ...targetBindings(sources),
    {
      name: "OTEL_EXPORTER_OTLP_HEADERS",
      text: sources.shared.otelHeaders,
      type: "secret_text",
    },
    ...Object.entries(plaintext).map(([name, text]) => ({ name, text, type: "plain_text" })),
    ...sentryRuntimeBindings(sources.settings),
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
      otelHeaders: shared.requireOutput("otelHeaders").apply(stackString),
    },
    settings: parseSharedConfig(rawSettings.value),
  };
}

function versionArgs(release: Release): WorkerVersionArgs {
  const bindings = runtimeBindings({
    accessAudience: release.accessAudience,
    origin: release.policy.origin,
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

async function deployApplication(target: AppTarget): Promise<Deployment> {
  const { outputs, settings } = await readSharedStack();
  const policy = appPolicy(settings, target);
  const artifacts = await loadArtifacts(
    fileURLToPath(new URL("../../../", import.meta.url)),
    target,
  );
  const worker = new Worker(`${target}-worker`, {
    accountId: settings.accountId,
    name: policy.name,
    observability: workerObservability,
    subdomain: policy.subdomain,
  });
  const access = target === "admin" ? adminAccess(settings, worker) : undefined;
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
