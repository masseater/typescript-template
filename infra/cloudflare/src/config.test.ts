import { describe, expect, it } from "vite-plus/test";
import {
  parseDeploymentCommand,
  parseSharedConfig,
  selectAccountPermission,
  validateAuthSecret,
  workerSubdomain,
} from "./config.ts";
import { readWikiConfig } from "@template/config";

const HEX_32_LENGTH = 32;
const AUTH_SECRET_LENGTH = 32;

const authSecret = "x".repeat(AUTH_SECRET_LENGTH);
const release = "0123456789abcdef";
const assetsBinding = { fetch: async (): Promise<Response> => new Response() };
const settings = {
  accountId: "a".repeat(HEX_32_LENGTH),
  budget: {
    budgetJpy: 5000,
    fixedCostUsd: 5,
    jpyPerUsd: 150,
    recipients: ["billing@example.com"],
    reserveUsd: 2,
  },
  mailFrom: "mail@example.com",
  origins: {
    admin: "https://admin.example.com",
    user: "https://user.example.com",
    wiki: "https://wiki.example.com",
  },
  prefix: "template-test",
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

describe("worker exposure", () => {
  it("workers disable every alternative public URL", () => {
    expect.hasAssertions();
    expect(workerSubdomain).toStrictEqual({ enabled: false, previewsEnabled: false });
  });
});

function wikiBindings(): Record<string, unknown> {
  const config = parseSharedConfig(settings);
  return {
    APP_ORIGIN: config.origins.wiki,
    APP_RELEASE: release,
    ASSETS: assetsBinding,
    AUTH_SECRET: "wiki-runtime-secret-at-least-32-characters",
    DB: { batch: async (): Promise<never[]> => [], prepare: (): undefined => undefined },
    EMAIL: { send: async (): Promise<undefined> => undefined },
    EMAIL_FROM: config.mailFrom,
  };
}

describe("wiki runtime settings", () => {
  it("the wiki reads authentication, database and release settings", () => {
    expect.hasAssertions();
    const runtime = readWikiConfig(wikiBindings());
    expect(runtime.APP_ORIGIN).toBe(settings.origins.wiki);
    expect(runtime.APP_RELEASE).toBe(release);
    expect(runtime.AI).toBeUndefined();
    expect(() => readWikiConfig({ ...wikiBindings(), DB: undefined })).toThrow("Invalid type");
  });

  it("the wiki accepts an optional AI binding", () => {
    expect.hasAssertions();
    const ai = { run: async (): Promise<{ data: never[] }> => ({ data: [] }) };
    expect(readWikiConfig({ ...wikiBindings(), AI: ai }).AI).toBe(ai);
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
  ])("rejects unsafe admin origin %s", (admin) => {
    expect.hasAssertions();
    expect(() =>
      parseSharedConfig({ ...settings, origins: { ...settings.origins, admin } }),
    ).toThrow("cloudflare_settings_invalid");
  });

  it("rejects same origins", () => {
    expect.hasAssertions();
    expect(() =>
      parseSharedConfig({
        ...settings,
        origins: { ...settings.origins, admin: settings.origins.user },
      }),
    ).toThrow("app_origins_must_differ");
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
    expect(selectAccountPermission([read, { ...read, name: "Billing Edit" }], "Billing Read")).toBe(
      read.id,
    );
    expect(() =>
      selectAccountPermission([{ ...read, name: "Billing Edit" }], "Billing Read"),
    ).toThrow("account_permission_unavailable");
    expect(() => selectAccountPermission([read, read], "Billing Read")).toThrow(
      "account_permission_unavailable",
    );
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
      selectAccountPermission(
        [write, { ...write, name: "Workers Scripts Write" }],
        "Workers Observability Write",
      ),
    ).toBe(write.id);
    expect(() =>
      selectAccountPermission(
        [{ ...write, name: "Workers Scripts Write" }],
        "Workers Observability Write",
      ),
    ).toThrow("account_permission_unavailable");
  });
});
