import { describe, expect, it } from "vite-plus/test";
import { reported, reportedRules } from "./lint-harness.ts";

const forbidden = [
  [
    "real-looking-host",
    "tools/observe/src/probe.test.ts",
    'export const origin = "https://probe.private-host.net";',
  ],
  [
    "real-looking-host-in-template",
    "tools/observe/src/probe.test.ts",
    "export const origin = `http://probe.private-host.net:3001/`;",
  ],
  [
    "real-looking-uuid",
    "libs/db/src/probe-fixture.ts",
    'export const databaseId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";',
  ],
  [
    "real-looking-secret",
    "infra/cloudflare/src/probe-fixture.ts",
    'export const authSecret = "Pr0beZ9xQ2mL7bN4hJ6sD8gW1yC5e3";',
  ],
  [
    "real-looking-secret-through-a-name",
    "infra/cloudflare/src/probe-fixture.ts",
    'const value = "Pr0beZ9xQ2mL7bN4hJ6sD8gW1yC5e3"; export const environment = { TEMPLATE_AUTH_SECRET: value };',
  ],
] as const;

const allowed = [
  ["tools/observe/src/probe.ts", 'export const origin = "https://probe.private-host.net";'],
  ["tools/observe/src/probe.test.ts", 'export const origin = "http://app.example.ts.net:3001/";'],
  ["tools/observe/src/probe.test.ts", 'export const origin = "http://127.0.0.1:3001/";'],
  ["tools/observe/src/probe.test.ts", 'export const origin = "https://api.cloudflare.com/x";'],
  ["tools/observe/src/probe.test.ts", 'export const event = "application.error";'],
  [
    "libs/db/src/probe-fixture.ts",
    'export const databaseId = "22222222-2222-4222-8222-222222222222";',
  ],
  [
    "infra/cloudflare/src/probe-fixture.ts",
    'export const authSecret = "verification-test-secret-0123456789abcdef";',
  ],
] as const;

describe("example values in tests and fixtures", () => {
  it.for(forbidden)("rejects a value that could be real: %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("example-values", name, code)).toBe(true);
  });

  it.for(allowed)("leaves self-declaring example values alone: %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reportedRules(name, code)).toStrictEqual([]);
  });
});
