import { expect, test } from "vite-plus/test";
import { readWikiConfig } from "@template/config";
import {
  parseSharedConfig,
  parseDeploymentCommand,
  selectAccountPermission,
  validateAuthSecret,
  workerSubdomain,
} from "./config.ts";

const settings = {
  accountId: "a".repeat(32),
  zoneId: "b".repeat(32),
  prefix: "template-test",
  origins: {
    user: "https://user.example.com",
    admin: "https://admin.example.com",
    wiki: "https://wiki.example.com",
  },
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

test("Workers disable every alternative public URL", () => {
  expect(workerSubdomain).toEqual({ enabled: false, previewsEnabled: false });
});

test("the wiki reads authentication, database and optional AI bindings", () => {
  const config = parseSharedConfig(settings);
  const bindings = {
    APP_ORIGIN: config.origins.wiki,
    AUTH_SECRET: "wiki-runtime-secret-at-least-32-characters",
    APP_RELEASE: "0123456789abcdef",
    EMAIL_FROM: config.mailFrom,
    ASSETS: { fetch: () => Promise.resolve(new Response()) },
    DB: { prepare: () => undefined, batch: () => Promise.resolve([]) },
    EMAIL: { send: () => Promise.resolve() },
  };
  const runtime = readWikiConfig(bindings);
  expect(runtime.APP_ORIGIN).toBe(settings.origins.wiki);
  expect(runtime.APP_RELEASE).toBe("0123456789abcdef");
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
  "not-a-url",
])("rejects unsafe admin origin %s", (admin) => {
  expect(() => parseSharedConfig({ ...settings, origins: { ...settings.origins, admin } })).toThrow(
    "cloudflare_settings_invalid",
  );
});

test("rejects same origins", () => {
  expect(() =>
    parseSharedConfig({
      ...settings,
      origins: { ...settings.origins, admin: settings.origins.user },
    }),
  ).toThrow("app_origins_must_differ");
});

test("refuses a budget exhausted by fixed fees", () => {
  expect(() =>
    parseSharedConfig({ ...settings, budget: { ...settings.budget, fixedCostUsd: 50 } }),
  ).toThrow("budget_has_no_usage_allowance");
});

test("selects Billing Read only and refuses substituted write scopes", () => {
  const read = { id: "c".repeat(32), name: "Billing Read", scopes: ["com.cloudflare.api.account"] };
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
