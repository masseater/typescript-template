import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { appPolicy, parseSharedConfig, validateAuthSecret } from "./config.ts";
import type { AppTarget } from "./config.ts";
import { loadArtifacts } from "./artifacts.ts";
import { archiveSourceMaps } from "./source-maps.ts";
import { workerObservability } from "./observability.ts";

export async function deployApplication(target: AppTarget) {
  const config = new pulumi.Config();
  const shared = new pulumi.StackReference(config.require("sharedStack"));
  const rawSettings = await shared.getOutputDetails("applicationSettings");
  const settings = Effect.runSync(parseSharedConfig(rawSettings.value));
  const policy = appPolicy(settings, target);
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const artifacts = await Effect.runPromise(
    loadArtifacts(repositoryRoot, target).pipe(
      Effect.tap((loaded) => archiveSourceMaps(repositoryRoot, target, loaded.release)),
    ),
  );
  const worker = new cloudflare.Worker(`${target}-worker`, {
    accountId: settings.accountId,
    name: policy.name,
    subdomain: policy.subdomain,
    observability: workerObservability,
  });
  const access =
    target === "admin"
      ? new cloudflare.ZeroTrustAccessApplication("admin-access", {
          accountId: settings.accountId,
          name: `${settings.prefix}-admin-access`,
          type: "self_hosted",
          destinations: [{ type: "worker", workerId: worker.id }],
          sessionDuration: "8h",
          httpOnlyCookieAttribute: true,
          policies: [
            {
              name: "named-admins",
              decision: "allow",
              precedence: 1,
              includes: settings.adminEmails.map((email) => ({ email: { email } })),
            },
          ],
        })
      : undefined;
  const plaintext = {
    APP_ORIGIN: policy.origin,
    APP_RELEASE: artifacts.release,
    ...(target === "wiki" ? {} : { EMAIL_FROM: settings.mailFrom }),
  };
  const bindings: cloudflare.types.input.WorkerVersionBinding[] = [
    ...(target === "wiki"
      ? [{ type: "ai", name: "AI" }]
      : [
          { type: "d1", name: "DB", id: shared.requireOutput("databaseId") },
          {
            type: "secret_text",
            name: "AUTH_SECRET",
            text: shared
              .requireOutput("authSecret")
              .apply((value: unknown) => Effect.runSync(validateAuthSecret(value))),
          },
          { type: "send_email", name: "EMAIL", allowedSenderAddresses: [settings.mailFrom] },
        ]),
    ...Object.entries(plaintext).map(([name, text]) => ({ type: "plain_text", name, text })),
    ...(access
      ? [
          { type: "plain_text", name: "ACCESS_AUD", text: access.aud },
          { type: "plain_text", name: "ACCESS_ISSUER", text: settings.accessIssuer },
        ]
      : []),
  ];
  const version = new cloudflare.WorkerVersion(
    `${target}-version`,
    {
      accountId: settings.accountId,
      workerId: worker.id,
      compatibilityDate: "2026-09-16",
      compatibilityFlags: ["nodejs_compat"],
      mainModule: artifacts.mainModule,
      modules: artifacts.modules,
      assets: { directory: artifacts.clientDirectory, config: policy.assets },
      bindings: [...bindings, { type: "assets", name: "ASSETS" }],
    },
    { dependsOn: access ? [access] : [] },
  );
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
    { dependsOn: [deployment, ...(access ? [access] : [])] },
  );
  return {
    workerName: worker.name,
    origin: pulumi.interpolate`https://${domain.hostname}`,
    accessAudience: access?.aud,
  };
}
