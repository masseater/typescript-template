import {
  APPLICATION,
  aiMeterEventName,
  aiUsageUnitAmount,
  appEnvKey,
  grants,
  jobsQueueBinding,
  jobsWorkflowBinding,
  jobsWorkflowClass,
  stripeApiVersion,
  stripeWebhookEvents,
  userInboxBinding,
  userInboxClassName,
  wikiApiBinding,
  wikiApiEntrypoint,
  wikiPagesBinding,
  wikiPublishKey,
  wikiWorker,
} from "@repo/config";
import { cacheNamespaceBinding, fileBucketBinding } from "@repo/config/storage";
import { workerCompatibility } from "@repo/config/worker";
import { coreEntrypoints } from "@repo/core-api/entrypoints";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { apiRoot } from "@repo/runtime/http";

import { observabilitySampling } from "./config.ts";
import { memberLeavePurgeCron } from "./member-leave-purge.ts";
import { stackName, stackReferences } from "./stacks.ts";
import { verificationSettings } from "./verification-settings.ts";

import type { Application, Capability } from "@repo/config";
import type { StackInventory } from "./inventory.ts";
import type { StackName } from "./stacks.ts";

type ResourceInventory = StackInventory["resources"][string];

const { accountId, budget, mailFrom, origins, otlp, prefix } = verificationSettings;

const sampling = { enabled: true, headSamplingRate: observabilitySampling };

const traceDestination = `${prefix}-traces`;

const sharedWorker = {
  compatibility: {
    date: workerCompatibility.date,
    flags: [...workerCompatibility.flags],
  },
  isExternal: true,
  observability: {
    ...sampling,
    logs: { ...sampling, invocationLogs: false },
    traces: { ...sampling, destinations: [traceDestination], persist: true },
  },
  workersDev: { enabled: false, previewsEnabled: false },
};

function plainText(name: string, value: number | string): string {
  return `${name}:plain_text:text=${value}`;
}

function zoneSetting(settingId: string, value: unknown): ResourceInventory {
  return {
    adopt: false,
    bindings: [],
    declared: { settingId, value, zoneId: verificationSettings.zoneId },
    removalPolicy: "destroy",
    type: "Cloudflare.Zone.Setting",
  };
}

function tokenValue(name: string, resource: string): string {
  return `${name}:deferred:${stackName("tokens")}.${resource}.value`;
}

function wikiBindings(app: Application): readonly string[] {
  return app === APPLICATION.wiki
    ? [
        tokenValue(appEnvKey.flagshipApiToken, "FlagshipWrite"),
        `${appEnvKey.flagshipAppId}:deferred:${stackName("flagship")}.App.appId`,
        `${wikiApiBinding}:service:entrypoint=${wikiApiEntrypoint}:service=${stackName(wikiWorker)}.Worker.workerName`,
        `${wikiPagesBinding}:service:service=${stackName(wikiWorker)}.Worker.workerName`,
        plainText(wikiPublishKey.appId, verificationSettings.wikiPublish.appId),
        `${wikiPublishKey.privateKey}:secret_text:text=$${deploymentKey.wikiPublishPrivateKey}`,
        plainText(wikiPublishKey.repository, verificationSettings.wikiPublish.repository),
      ]
    : [];
}

function analyticsBindings(app: Application): readonly string[] {
  return app === APPLICATION.user
    ? [
        plainText(
          appEnvKey.googleAnalyticsMeasurementId,
          verificationSettings.googleAnalyticsMeasurementId,
        ),
      ]
    : [];
}

const capabilityBindings: readonly (readonly [Capability, readonly string[]])[] = [
  [
    "billing",
    [
      "STRIPE_METERED_PRICE_ID:deferred:<unresolved PropExpr>",
      "STRIPE_PRICE_ID:deferred:<unresolved PropExpr>",
      `STRIPE_SECRET_KEY:secret_text:text=$${deploymentKey.stripeSecretKey}`,
      "STRIPE_WEBHOOK_SECRET:deferred:<unresolved EffectExpr>",
    ],
  ],
  ["workers-ai", ["AI:ai"]],
  [
    "jobs",
    [
      `${jobsQueueBinding}:queue:queueId=<unresolved PropExpr>:queueName=<unresolved PropExpr>`,
      `${jobsWorkflowBinding}:workflow:className=${jobsWorkflowClass}:workflowName=<unresolved EffectExpr>`,
    ],
  ],
  ["realtime", [`${userInboxBinding}:durable_object_namespace:className=${userInboxClassName}`]],
  [
    "storage",
    [
      `${cacheNamespaceBinding}:kv_namespace:namespaceId=${stackName("storage")}.Cache.namespaceId`,
      `${fileBucketBinding}:r2_bucket:bucketName=${stackName("storage")}.Files.bucketName:jurisdiction=<unresolved ApplyExpr>`,
    ],
  ],
];

function grantedBindings(app: Application): readonly string[] {
  return capabilityBindings.flatMap(([capability, bindings]) =>
    grants(app, capability) ? bindings : [],
  );
}

function applicationCrons(app: Application): { readonly crons?: readonly string[] } {
  return {
    ...(app === APPLICATION.user ? { crons: [memberLeavePurgeCron] } : {}),
    ...(app === APPLICATION.wiki ? { crons: ["*/30 * * * *"] } : {}),
  };
}

function billingResources(app: Application): Readonly<Record<string, ResourceInventory>> {
  if (!grants(app, "billing")) {
    return {};
  }
  return {
    AiUsage: {
      adopt: false,
      bindings: [],
      declared: {
        defaultAggregation: { formula: "sum" },
        displayName: `${prefix} AI usage`,
        eventName: aiMeterEventName,
      },
      removalPolicy: "destroy",
      type: "Stripe.BillingMeter",
    },
    AiUsageMonthly: {
      adopt: false,
      bindings: [],
      declared: {
        currency: "jpy",
        product: "<unresolved PropExpr>",
        recurring: { interval: "month", meter: "<unresolved PropExpr>", usageType: "metered" },
        unitAmount: aiUsageUnitAmount,
      },
      removalPolicy: "destroy",
      type: "Stripe.Price",
    },
    BillingWebhook: {
      adopt: false,
      bindings: [],
      declared: {
        apiVersion: stripeApiVersion,
        enabledEvents: [...stripeWebhookEvents],
        url: `${origins[app]}${apiRoot}/billing/webhook`,
      },
      removalPolicy: "destroy",
      type: "Stripe.WebhookEndpoint",
    },
    PaidMonthly: {
      adopt: false,
      bindings: [],
      declared: {
        currency: "jpy",
        product: "<unresolved PropExpr>",
        recurring: { interval: "month" },
        unitAmount: 500,
      },
      removalPolicy: "destroy",
      type: "Stripe.Price",
    },
    PaidPlan: {
      adopt: false,
      bindings: [],
      declared: { name: `${prefix} paid plan` },
      removalPolicy: "destroy",
      type: "Stripe.Product",
    },
  };
}

function applicationResource(app: Application, release: string): ResourceInventory {
  return {
    adopt: false,
    bindings: [
      plainText(appEnvKey.appOrigin, origins[app]),
      plainText(appEnvKey.appRelease, release),
      `${appEnvKey.authSecret}:secret_text:text=$${deploymentKey.authSecret}`,
      `CORE:service:entrypoint=${coreEntrypoints[app]}:service=${stackName("core")}.Worker.workerName`,
      `DB:d1:databaseId=${stackName("database")}.Database.databaseId`,
      `EMAIL:send_email:allowedSenderAddresses=${mailFrom}`,
      plainText(appEnvKey.emailFrom, mailFrom),
      plainText(appEnvKey.flagshipAccountId, accountId),
      `FLAGS:flagship:appId=${stackName("flagship")}.App.appId`,
      ...wikiBindings(app),
      ...analyticsBindings(app),
      plainText(appEnvKey.opsEmail, budget.recipients[0] ?? mailFrom),
      `${appEnvKey.otlpAuthorization}:secret_text:text=$${deploymentKey.otlpAuthorization}`,
      plainText(appEnvKey.otlpEndpoint, otlp.endpoint),
      ...grantedBindings(app),
    ].toSorted(),
    declared: {
      ...sharedWorker,
      assets: {
        directory: `infra/cloudflare/.artifacts/${app}/<digest>/client`,
        runWorkerFirst: true,
      },
      bundle: false,
      ...applicationCrons(app),
      domain: { name: new URL(origins[app]).hostname, zoneId: verificationSettings.zoneId },
      main: `infra/cloudflare/.artifacts/${app}/<digest>/server/index.js`,
      name: `${prefix}-${app}`,
      rules: [{ globs: ["**/*.js", "**/*.mjs", "**/*.txt", "**/*.wasm", "**/*.map"] }],
    },
    removalPolicy: "destroy",
    type: "Cloudflare.Worker",
  };
}

function jobsResources(app: Application): Readonly<Record<string, ResourceInventory>> {
  if (!grants(app, "jobs")) {
    return {};
  }
  return {
    Jobs: {
      adopt: false,
      bindings: [],
      declared: {},
      removalPolicy: "destroy",
      type: "Cloudflare.Queues.Queue",
    },
    JobsConsumer: {
      adopt: false,
      bindings: [],
      declared: {
        queueId: "<unresolved PropExpr>",
        scriptName: "<unresolved PropExpr>",
      },
      removalPolicy: "destroy",
      type: "Cloudflare.Queues.Consumer",
    },
    Process: {
      adopt: false,
      bindings: [],
      declared: {
        className: jobsWorkflowClass,
        scriptName: "<unresolved PropExpr>",
        workflowName: "<unresolved EffectExpr>",
      },
      removalPolicy: "destroy",
      type: "Cloudflare.Workflow",
    },
  };
}

function monitorResource(options: {
  readonly artifact: string;
  readonly className: string;
  readonly cron: string;
  readonly name: string;
  readonly variables: readonly string[];
}): ResourceInventory {
  return {
    adopt: false,
    bindings: [
      plainText("ALERT_FROM", mailFrom),
      plainText("ALERT_TO", budget.recipients.join(",")),
      `EMAIL:send_email:allowedDestinationAddresses=${[...budget.recipients].toSorted().join(",")}:allowedSenderAddresses=${mailFrom}`,
      `MONITOR:durable_object_namespace:className=${options.className}`,
      ...options.variables,
    ].toSorted(),
    declared: {
      ...sharedWorker,
      bundle: false,
      crons: [options.cron],
      main: options.artifact,
      name: `${prefix}-${options.name}`,
    },
    removalPolicy: "destroy",
    type: "Cloudflare.Worker",
  };
}

function accountToken(
  slug: string,
  permission: string | { readonly id: string },
): ResourceInventory {
  return {
    adopt: false,
    bindings: [],
    declared: {
      name: `${prefix}-${slug}`,
      policies: [
        {
          effect: "allow",
          permissionGroups: [permission],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
      ],
    },
    removalPolicy: "destroy",
    type: "Cloudflare.ApiToken.AccountApiToken",
  };
}

function declaredStack(
  stack: StackName,
  resources: Readonly<Record<string, ResourceInventory>>,
): StackInventory {
  return {
    dependencies: stackReferences[stack].map((reference) => stackName(reference)).toSorted(),
    name: stackName(stack),
    resources,
  };
}

export {
  accountId,
  accountToken,
  applicationResource,
  billingResources,
  declaredStack,
  jobsResources,
  monitorResource,
  plainText,
  sharedWorker,
  tokenValue,
  traceDestination,
  zoneSetting,
};
export type { ResourceInventory };
