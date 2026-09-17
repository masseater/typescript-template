import {
  appPolicy,
  parseDeploymentCommand,
  parseSharedConfig,
  selectReadPermission,
  sentryRuntimeBindings,
  validateAuthSecret,
  validateOtelHeaders,
} from "./config.ts";
import { describe, expect, it } from "vitest";
import { readEnvironment, readWikiConfig } from "@template/config";

const HEX_32_LENGTH = 32;
const AUTH_SECRET_LENGTH = 32;
const MAX_SENTRY_ENVIRONMENT_LENGTH = 64;
const MAX_SENTRY_RELEASE_LENGTH = 128;

const authSecret = "x".repeat(AUTH_SECRET_LENGTH);
const sentryDsn = "https://key@sentry.example.com/1";
const assetsBinding = { fetch: async (): Promise<Response> => new Response() };
const settings = {
  accessIssuer: "https://team.cloudflareaccess.com",
  accountId: "a".repeat(HEX_32_LENGTH),
  adminEmails: ["admin@example.com"],
  adminOrigin: "https://admin.example.com",
  budget: {
    budgetJpy: 5000,
    fixedCostUsd: 5,
    jpyPerUsd: 150,
    recipients: ["billing@example.com"],
    reserveUsd: 2,
  },
  mailFrom: "mail@example.com",
  otelEndpoint: "https://telemetry.example.com/otlp",
  prefix: "template-test",
  userOrigin: "https://user.example.com",
  wikiOrigin: "https://wiki.example.com",
  zoneId: "b".repeat(HEX_32_LENGTH),
};
const completeSentry = { sentryDsn, sentryEnvironment: "production", sentryRelease: "rev-1" };

function appRuntime(
  config: ReturnType<typeof parseSharedConfig>,
  target: "admin" | "user",
): ReturnType<typeof readEnvironment> {
  return readEnvironment({
    APP_ORIGIN: appPolicy(config, target).origin,
    AUTH_SECRET: authSecret,
    EMAIL_FROM: config.mailFrom,
    OTEL_EXPORTER_OTLP_ENDPOINT: config.otelEndpoint,
    ...Object.fromEntries(sentryRuntimeBindings(config).map(({ name, text }) => [name, text])),
  });
}

describe("deployment commands", () => {
  it("rejects ignored arguments instead of selecting an unintended stack", () => {
    expect.hasAssertions();
    expect(parseDeploymentCommand(["preview", "admin"])).toStrictEqual({
      operation: "preview",
      target: "admin",
    });
    expect(() => parseDeploymentCommand(["up", "user", "--stack", "other"])).toThrow(
      "deployment_command_invalid",
    );
    expect(parseDeploymentCommand(["up", "wiki"])).toStrictEqual({
      operation: "up",
      target: "wiki",
    });
    expect(() => parseDeploymentCommand(["up", "unknown"])).toThrow("deployment_command_invalid");
  });
});

describe("sentry runtime bindings", () => {
  it("omitting the Sentry DSN disables all Sentry runtime bindings", () => {
    expect.hasAssertions();
    expect(sentryRuntimeBindings(parseSharedConfig(settings))).toStrictEqual([]);
    expect(
      sentryRuntimeBindings(
        parseSharedConfig({ ...settings, sentryEnvironment: "production", sentryRelease: "rev-1" }),
      ),
    ).toStrictEqual([]);
  });

  it.each([{}, { sentryEnvironment: "production" }, { sentryRelease: "rev-1" }])(
    "a Sentry DSN requires environment and release: %j",
    (additional) => {
      expect.hasAssertions();
      expect(() => parseSharedConfig({ ...settings, sentryDsn, ...additional })).toThrow(
        "sentry_environment_and_release_required",
      );
    },
  );

  it.each(["sentryEnvironment", "sentryRelease"])("rejects blank %s", (name) => {
    expect.hasAssertions();
    expect(() => parseSharedConfig({ ...settings, ...completeSentry, [name]: " " })).toThrow(
      "cloudflare_settings_invalid",
    );
  });

  it("binds complete Sentry settings at runtime", () => {
    expect.hasAssertions();
    const config = parseSharedConfig({ ...settings, ...completeSentry });
    expect(sentryRuntimeBindings(config)).toStrictEqual([
      { name: "SENTRY_DSN", text: config.sentryDsn, type: "plain_text" },
      { name: "SENTRY_ENVIRONMENT", text: "production", type: "plain_text" },
      { name: "SENTRY_RELEASE", text: "rev-1", type: "plain_text" },
    ]);
  });
});

describe("sentry settings rejected by the runtime", () => {
  it.each([
    { sentryEnvironment: "Production" },
    { sentryEnvironment: " production" },
    { sentryEnvironment: "prod/blue" },
    { sentryEnvironment: "a".repeat(MAX_SENTRY_ENVIRONMENT_LENGTH + 1) },
    { sentryRelease: "release@1" },
    { sentryRelease: "release/1" },
    { sentryRelease: "release 1" },
    { sentryRelease: "a".repeat(MAX_SENTRY_RELEASE_LENGTH + 1) },
  ])("rejects settings the runtime cannot consume: %j", (overrides) => {
    expect.hasAssertions();
    const config = { ...settings, ...completeSentry, ...overrides };
    expect(() => parseSharedConfig(config)).toThrow("cloudflare_settings_invalid");
    expect(() =>
      readEnvironment({
        APP_ORIGIN: settings.userOrigin,
        AUTH_SECRET: authSecret,
        EMAIL_FROM: settings.mailFrom,
        OTEL_EXPORTER_OTLP_ENDPOINT: settings.otelEndpoint,
        SENTRY_DSN: config.sentryDsn,
        SENTRY_ENVIRONMENT: config.sentryEnvironment,
        SENTRY_RELEASE: config.sentryRelease,
      }),
    ).toThrow("Invalid format");
  });
});

describe("generated sentry bindings", () => {
  it.each(["user", "admin"] as const)(
    "generated %s bindings without Sentry disable runtime Sentry",
    (target) => {
      expect.hasAssertions();
      expect(appRuntime(parseSharedConfig(settings), target).sentry).toBeUndefined();
    },
  );

  it.each([
    ["user", "production", "release_1.2-ABC"],
    ["admin", "production", "release_1.2-ABC"],
    ["user", "a".repeat(MAX_SENTRY_ENVIRONMENT_LENGTH), "A".repeat(MAX_SENTRY_RELEASE_LENGTH)],
    ["admin", "a".repeat(MAX_SENTRY_ENVIRONMENT_LENGTH), "A".repeat(MAX_SENTRY_RELEASE_LENGTH)],
  ] as const)(
    "generated %s bindings are accepted by the real runtime: %s %s",
    (target, environment, release) => {
      expect.hasAssertions();
      const config = parseSharedConfig({
        ...settings,
        sentryDsn,
        sentryEnvironment: environment,
        sentryRelease: release,
      });
      expect(appRuntime(config, target).sentry).toStrictEqual({
        dsn: sentryDsn,
        environment,
        release,
      });
    },
  );
});

describe("application policy", () => {
  it("user and admin are distinct deployments with all alternative public URLs disabled", () => {
    expect.hasAssertions();
    const config = parseSharedConfig(settings);
    expect(appPolicy(config, "user")).toStrictEqual({
      assets: { runWorkerFirst: true },
      name: "template-test-user",
      origin: settings.userOrigin,
      subdomain: { enabled: false, previewsEnabled: false },
    });
    expect(appPolicy(config, "admin")).toStrictEqual({
      assets: { runWorkerFirst: true },
      name: "template-test-admin",
      origin: settings.adminOrigin,
      subdomain: { enabled: false, previewsEnabled: false },
    });
    expect(appPolicy(config, "wiki")).toStrictEqual({
      assets: { runWorkerFirst: true },
      name: "template-test-wiki",
      origin: settings.wikiOrigin,
      subdomain: { enabled: false, previewsEnabled: false },
    });
  });
});

describe("wiki runtime settings", () => {
  it("the wiki reads its runtime settings without authentication or database bindings", () => {
    expect.hasAssertions();
    const config = parseSharedConfig(settings);
    const runtime = readWikiConfig({
      APP_ORIGIN: appPolicy(config, "wiki").origin,
      ASSETS: assetsBinding,
      OTEL_EXPORTER_OTLP_ENDPOINT: config.otelEndpoint,
      OTEL_EXPORTER_OTLP_HEADERS: "{}",
    });
    expect(runtime.APP_ORIGIN).toBe(settings.wikiOrigin);
    expect(runtime.sentry).toBeUndefined();
    expect(runtime.AI).toBeUndefined();
  });

  it("the wiki accepts an optional AI binding", () => {
    expect.hasAssertions();
    const config = parseSharedConfig(settings);
    const ai = { run: async (): Promise<{ data: never[] }> => ({ data: [] }) };
    expect(
      readWikiConfig({
        AI: ai,
        APP_ORIGIN: appPolicy(config, "wiki").origin,
        ASSETS: assetsBinding,
        OTEL_EXPORTER_OTLP_ENDPOINT: config.otelEndpoint,
      }).AI,
    ).toBe(ai);
  });
});

describe("shared settings validation", () => {
  it.each([
    "http://admin.example.com",
    "https://admin.example.com/path",
    "https://admin.example.com/",
    "https://admin.example.com?x=1",
    "https://app.team.workers.dev",
  ])("rejects unsafe admin origin %s", (adminOrigin) => {
    expect.hasAssertions();
    expect(() => parseSharedConfig({ ...settings, adminOrigin })).toThrow(
      "cloudflare_settings_invalid",
    );
  });

  it("rejects same origins and empty management allowlists", () => {
    expect.hasAssertions();
    expect(() => parseSharedConfig({ ...settings, adminOrigin: settings.userOrigin })).toThrow(
      "app_origins_must_differ",
    );
    expect(() => parseSharedConfig({ ...settings, adminEmails: [] })).toThrow(
      "cloudflare_settings_invalid",
    );
  });

  it("refuses a budget exhausted by fixed fees", () => {
    expect.hasAssertions();
    expect(() =>
      parseSharedConfig({ ...settings, budget: { ...settings.budget, fixedCostUsd: 50 } }),
    ).toThrow("budget_has_no_usage_allowance");
  });
});

describe("credential validation", () => {
  it("selects Billing Read only and refuses substituted write scopes", () => {
    expect.hasAssertions();
    const read = {
      id: "c".repeat(HEX_32_LENGTH),
      name: "Billing Read",
      scopes: ["com.cloudflare.api.account"],
    };
    expect(selectReadPermission([read, { ...read, name: "Billing Edit" }])).toBe(read.id);
    expect(() => selectReadPermission([{ ...read, name: "Billing Edit" }])).toThrow(
      "billing_read_permission_unavailable",
    );
    expect(() => selectReadPermission([read, read])).toThrow("billing_read_permission_unavailable");
  });

  it("secret and exporter validation errors do not include their inputs", () => {
    expect.hasAssertions();
    expect(() => validateAuthSecret("private-value")).toThrow("auth_secret_invalid");
    expect(validateAuthSecret(authSecret)).toBe(authSecret);
    expect(validateOtelHeaders('{"Authorization":"Bearer sample"}')).toBe(
      '{"Authorization":"Bearer sample"}',
    );
    expect(() => validateOtelHeaders(String.raw`{"Authorization":"bad\nheader"}`)).toThrow(
      "otel_headers_invalid",
    );
    expect(() => validateOtelHeaders("private-not-json")).toThrow("otel_headers_invalid");
  });
});
