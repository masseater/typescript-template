import {
  appPolicy,
  parseDeploymentCommand,
  parseSharedConfig,
  selectObservabilityQueryPermission,
  selectReadPermission,
  validateAuthSecret,
} from "./config.ts";
import { describe, expect, it } from "vite-plus/test";
import { readWikiConfig } from "@template/config";

const HEX_32_LENGTH = 32;
const AUTH_SECRET_LENGTH = 32;

const authSecret = "x".repeat(AUTH_SECRET_LENGTH);
const release = "0123456789abcdef";
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
  prefix: "template-test",
  userOrigin: "https://user.example.com",
  wikiOrigin: "https://wiki.example.com",
  zoneId: "b".repeat(HEX_32_LENGTH),
};

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
  it("the wiki reads its production settings without authentication or database bindings", () => {
    expect.hasAssertions();
    const config = parseSharedConfig(settings);
    const runtime = readWikiConfig({
      APP_ORIGIN: appPolicy(config, "wiki").origin,
      APP_RELEASE: release,
      ASSETS: assetsBinding,
    });
    expect(runtime.APP_ORIGIN).toBe(settings.wikiOrigin);
    expect(runtime.APP_RELEASE).toBe(release);
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
    "not-a-url",
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

  it("secret validation errors do not include their inputs", () => {
    expect.hasAssertions();
    expect(() => validateAuthSecret("private-value")).toThrow("auth_secret_invalid");
    expect(validateAuthSecret(authSecret)).toBe(authSecret);
  });

  it("the error monitor token may only run Workers Observability queries", () => {
    expect.hasAssertions();
    const write = {
      id: "d".repeat(HEX_32_LENGTH),
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
});
