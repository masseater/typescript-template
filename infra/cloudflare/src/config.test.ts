import { expect, test } from "vite-plus/test";
import { readEnvironment, readWikiConfig } from "@template/config";
import {
  appPolicy,
  parseSharedConfig,
  parseDeploymentCommand,
  selectReadPermission,
  sentryRuntimeBindings,
  validateAuthSecret,
  validateOtelHeaders,
} from "./config.ts";

const settings = {
  accountId: "a".repeat(32),
  zoneId: "b".repeat(32),
  prefix: "template-test",
  userOrigin: "https://user.example.com",
  adminOrigin: "https://admin.example.com",
  wikiOrigin: "https://wiki.example.com",
  otelEndpoint: "https://telemetry.example.com/otlp",
  mailFrom: "mail@example.com",
  budget: {
    budgetJpy: 5000,
    jpyPerUsd: 150,
    fixedCostUsd: 5,
    reserveUsd: 2,
    recipients: ["billing@example.com"],
  },
};

test("deployment commands reject ignored arguments instead of selecting an unintended stack", () => {
  expect(parseDeploymentCommand(["preview", "admin"])).toEqual({
    operation: "preview",
    target: "admin",
  });
  expect(() => parseDeploymentCommand(["up", "user", "--stack", "other"])).toThrow(
    "deployment_command_invalid",
  );
  expect(parseDeploymentCommand(["up", "wiki"])).toEqual({ operation: "up", target: "wiki" });
  expect(() => parseDeploymentCommand(["up", "unknown"])).toThrow("deployment_command_invalid");
});

test("omitting the Sentry DSN disables all Sentry runtime bindings", () => {
  expect(sentryRuntimeBindings(parseSharedConfig(settings))).toEqual([]);
  expect(
    sentryRuntimeBindings(
      parseSharedConfig({ ...settings, sentryEnvironment: "production", sentryRelease: "rev-1" }),
    ),
  ).toEqual([]);
});

test.each([{}, { sentryEnvironment: "production" }, { sentryRelease: "rev-1" }])(
  "a Sentry DSN requires environment and release: %j",
  (additional) => {
    expect(() =>
      parseSharedConfig({
        ...settings,
        sentryDsn: "https://key@sentry.example.com/1",
        ...additional,
      }),
    ).toThrow("sentry_environment_and_release_required");
  },
);

test.each(["sentryEnvironment", "sentryRelease"])("rejects blank %s", (name) => {
  expect(() =>
    parseSharedConfig({
      ...settings,
      sentryDsn: "https://key@sentry.example.com/1",
      sentryEnvironment: "production",
      sentryRelease: "rev-1",
      [name]: " ",
    }),
  ).toThrow("cloudflare_settings_invalid");
});

test("binds complete Sentry settings at runtime", () => {
  const config = parseSharedConfig({
    ...settings,
    sentryDsn: "https://key@sentry.example.com/1",
    sentryEnvironment: "production",
    sentryRelease: "rev-1",
  });
  expect(sentryRuntimeBindings(config)).toEqual([
    { type: "plain_text", name: "SENTRY_DSN", text: config.sentryDsn },
    { type: "plain_text", name: "SENTRY_ENVIRONMENT", text: "production" },
    { type: "plain_text", name: "SENTRY_RELEASE", text: "rev-1" },
  ]);
});

test.each([
  { sentryEnvironment: "Production" },
  { sentryEnvironment: " production" },
  { sentryEnvironment: "prod/blue" },
  { sentryEnvironment: "a".repeat(65) },
  { sentryRelease: "release@1" },
  { sentryRelease: "release/1" },
  { sentryRelease: "release 1" },
  { sentryRelease: "a".repeat(129) },
])("rejects settings the runtime cannot consume: %j", (overrides) => {
  const config = {
    ...settings,
    sentryDsn: "https://key@sentry.example.com/1",
    sentryEnvironment: "production",
    sentryRelease: "rev-1",
    ...overrides,
  };
  expect(() => parseSharedConfig(config)).toThrow("cloudflare_settings_invalid");
  expect(() =>
    readEnvironment({
      APP_ORIGIN: settings.userOrigin,
      AUTH_SECRET: "x".repeat(32),
      OTEL_EXPORTER_OTLP_ENDPOINT: settings.otelEndpoint,
      EMAIL_FROM: settings.mailFrom,
      SENTRY_DSN: config.sentryDsn,
      SENTRY_ENVIRONMENT: config.sentryEnvironment,
      SENTRY_RELEASE: config.sentryRelease,
    }),
  ).toThrow("Invalid format");
});

test.each([
  {},
  {
    sentryDsn: "https://key@sentry.example.com/1",
    sentryEnvironment: "production",
    sentryRelease: "release_1.2-ABC",
  },
  {
    sentryDsn: "https://key@sentry.example.com/1",
    sentryEnvironment: "a".repeat(64),
    sentryRelease: "A".repeat(128),
  },
])("generated bindings are accepted by the real runtime: %j", (sentry) => {
  const config = parseSharedConfig({ ...settings, ...sentry });
  const bindings = Object.fromEntries(
    sentryRuntimeBindings(config).map(({ name, text }) => [name, text]),
  );
  for (const target of ["user", "admin"] as const) {
    const runtime = readEnvironment({
      APP_ORIGIN: appPolicy(config, target).origin,
      AUTH_SECRET: "x".repeat(32),
      OTEL_EXPORTER_OTLP_ENDPOINT: config.otelEndpoint,
      EMAIL_FROM: config.mailFrom,
      ...bindings,
    });
    expect(runtime.sentry).toEqual(
      config.sentryDsn
        ? {
            dsn: config.sentryDsn,
            environment: config.sentryEnvironment,
            release: config.sentryRelease,
          }
        : null,
    );
  }
});

test("user and admin are distinct deployments with all alternative public URLs disabled", () => {
  const config = parseSharedConfig(settings);
  expect(appPolicy(config, "user")).toEqual({
    name: "template-test-user",
    origin: settings.userOrigin,
    subdomain: { enabled: false, previewsEnabled: false },
    assets: { runWorkerFirst: true },
  });
  expect(appPolicy(config, "admin").name).toBe("template-test-admin");
  expect(appPolicy(config, "admin").subdomain).toEqual({ enabled: false, previewsEnabled: false });
  expect(appPolicy(config, "admin").assets.runWorkerFirst).toBe(true);
  expect(appPolicy(config, "wiki")).toEqual({
    name: "template-test-wiki",
    origin: settings.wikiOrigin,
    subdomain: { enabled: false, previewsEnabled: false },
    assets: { runWorkerFirst: true },
  });
});

test("the wiki reads authentication, database and optional AI bindings", () => {
  const config = parseSharedConfig(settings);
  const bindings = {
    APP_ORIGIN: appPolicy(config, "wiki").origin,
    AUTH_SECRET: "wiki-runtime-secret-at-least-32-characters",
    OTEL_EXPORTER_OTLP_ENDPOINT: config.otelEndpoint,
    OTEL_EXPORTER_OTLP_HEADERS: "{}",
    EMAIL_FROM: config.mailFrom,
    ASSETS: { fetch: () => Promise.resolve(new Response()) },
    DB: { prepare: () => undefined, batch: () => Promise.resolve([]) },
    EMAIL: { send: () => Promise.resolve() },
  };
  const runtime = readWikiConfig(bindings);
  expect(runtime.APP_ORIGIN).toBe(settings.wikiOrigin);
  expect(runtime.sentry).toBeNull();
  expect(runtime.AI).toBeNull();
  const ai = { run: () => Promise.resolve({ data: [] }) };
  expect(readWikiConfig({ ...bindings, AI: ai }).AI).toBe(ai);
  expect(() => readWikiConfig({ ...bindings, DB: undefined })).toThrow("Invalid type");
});

test.each([
  "http://admin.example.com",
  "https://admin.example.com/path",
  "https://admin.example.com/",
  "https://admin.example.com?x=1",
  "https://app.team.workers.dev",
])("rejects unsafe admin origin %s", (adminOrigin) => {
  expect(() => parseSharedConfig({ ...settings, adminOrigin })).toThrow(
    "cloudflare_settings_invalid",
  );
});

test("rejects same origins", () => {
  expect(() => parseSharedConfig({ ...settings, adminOrigin: settings.userOrigin })).toThrow(
    "app_origins_must_differ",
  );
});

test("refuses a budget exhausted by fixed fees", () => {
  expect(() =>
    parseSharedConfig({ ...settings, budget: { ...settings.budget, fixedCostUsd: 50 } }),
  ).toThrow("budget_has_no_usage_allowance");
});

test("selects Billing Read only and refuses substituted write scopes", () => {
  const read = { id: "c".repeat(32), name: "Billing Read", scopes: ["com.cloudflare.api.account"] };
  expect(selectReadPermission([read, { ...read, name: "Billing Edit" }])).toBe(read.id);
  expect(() => selectReadPermission([{ ...read, name: "Billing Edit" }])).toThrow(
    "billing_read_permission_unavailable",
  );
  expect(() => selectReadPermission([read, read])).toThrow("billing_read_permission_unavailable");
});

test("secret and exporter validation errors do not include their inputs", () => {
  expect(() => validateAuthSecret("private-value")).toThrow("auth_secret_invalid");
  expect(validateAuthSecret("x".repeat(32))).toBe("x".repeat(32));
  expect(validateOtelHeaders('{"Authorization":"Bearer sample"}')).toBe(
    '{"Authorization":"Bearer sample"}',
  );
  expect(() => validateOtelHeaders('{"Authorization":"bad\\nheader"}')).toThrow(
    "otel_headers_invalid",
  );
  expect(() => validateOtelHeaders("private-not-json")).toThrow("otel_headers_invalid");
});
