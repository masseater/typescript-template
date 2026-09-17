import { expect, test } from "vitest";
import { readWikiConfig } from "@template/config";
import {
  appPolicy,
  parseSharedConfig,
  parseDeploymentCommand,
  selectObservabilityQueryPermission,
  selectReadPermission,
  validateAlertWebhookUrl,
  validateAuthSecret,
} from "./config.ts";

const settings = {
  accountId: "a".repeat(32),
  zoneId: "b".repeat(32),
  prefix: "template-test",
  userOrigin: "https://user.example.com",
  adminOrigin: "https://admin.example.com",
  wikiOrigin: "https://wiki.example.com",
  accessIssuer: "https://team.cloudflareaccess.com",
  adminEmails: ["admin@example.com"],
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

test("the wiki reads its production settings without authentication, database or OTLP bindings", () => {
  const config = parseSharedConfig(settings);
  const runtime = readWikiConfig({
    APP_ORIGIN: appPolicy(config, "wiki").origin,
    APP_RELEASE: "0123456789abcdef",
    ASSETS: { fetch: () => Promise.resolve(new Response()) },
  });
  expect(runtime.APP_ORIGIN).toBe(settings.wikiOrigin);
  expect(runtime.APP_RELEASE).toBe("0123456789abcdef");
  expect(runtime.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  expect(runtime.AI).toBeNull();
  const ai = { run: () => Promise.resolve({ data: [] }) };
  expect(
    readWikiConfig({
      APP_ORIGIN: appPolicy(config, "wiki").origin,
      ASSETS: { fetch: () => Promise.resolve(new Response()) },
      AI: ai,
    }).AI,
  ).toBe(ai);
});

test.each([
  "http://admin.example.com",
  "https://admin.example.com/path",
  "https://admin.example.com/",
  "https://admin.example.com?x=1",
  "https://app.team.workers.dev",
  "not-a-url",
])("rejects unsafe admin origin %s", (adminOrigin) => {
  expect(() => parseSharedConfig({ ...settings, adminOrigin })).toThrow(
    "cloudflare_settings_invalid",
  );
});

test("rejects same origins and empty management allowlists", () => {
  expect(() => parseSharedConfig({ ...settings, adminOrigin: settings.userOrigin })).toThrow(
    "app_origins_must_differ",
  );
  expect(() => parseSharedConfig({ ...settings, adminEmails: [] })).toThrow(
    "cloudflare_settings_invalid",
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

test("secret validation errors do not include their inputs", () => {
  expect(() => validateAuthSecret("private-value")).toThrow("auth_secret_invalid");
  expect(validateAuthSecret("x".repeat(32))).toBe("x".repeat(32));
});

test("the error monitor token may only run Workers Observability queries", () => {
  const write = {
    id: "d".repeat(32),
    name: "Workers Observability Write",
    scopes: ["com.cloudflare.api.account"],
  };
  expect(
    selectObservabilityQueryPermission([write, { ...write, name: "Workers Scripts Write" }]),
  ).toBe(write.id);
  expect(() =>
    selectObservabilityQueryPermission([{ ...write, name: "Workers Scripts Write" }]),
  ).toThrow("observability_query_permission_unavailable");
});

test.each([
  "http://hooks.example.com/x",
  "https://user:pass@hooks.example.com/x",
  "private-not-a-url",
])("alert webhook %s is refused without echoing the input", (value) => {
  expect(() => validateAlertWebhookUrl(value)).toThrow(/^alert_webhook_url_invalid$/);
});

test("Discord's Slack-compatible webhook URL is accepted", () => {
  expect(validateAlertWebhookUrl("https://discord.com/api/webhooks/1/token/slack")).toBe(
    "https://discord.com/api/webhooks/1/token/slack",
  );
});
