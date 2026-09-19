import { describe, expect, it } from "vite-plus/test";

import { reported, reportedRules } from "./lint-harness.ts";

const githubTokenProbe = `export const token = "${["ghp_", "a".repeat(40)].join("")}";`;
const awsAccessKeyProbe = `export const accessKey = "${["AKIA", "A".repeat(16)].join("")}";`;

const forbidden = [
  [
    "real-looking-host",
    "tools/dev/src/observe/probe.test.ts",
    'export const origin = "https://probe.private-host.net";',
  ],
  [
    "real-looking-host-in-template",
    "tools/dev/src/observe/probe.test.ts",
    "export const origin = `http://probe.private-host.net:3001/`;",
  ],
  [
    "bare-hostname",
    "tools/dev/src/observe/probe.test.ts",
    'export const host = "probe.private-host.net";',
  ],
  [
    "reserved-label-bypass",
    "tools/dev/src/observe/probe.test.ts",
    'export const origin = "https://internal.example-corp.com";',
  ],
  [
    "websocket-host",
    "tools/dev/src/observe/probe.test.ts",
    'export const origin = "wss://probe.private-host.net/ws";',
  ],
  [
    "scheme-relative-host",
    "tools/dev/src/observe/probe.test.ts",
    'export const origin = "//probe.private-host.net/path";',
  ],
  [
    "real-looking-uuid",
    "libs/db/src/probe-fixture.ts",
    'export const databaseId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";',
  ],
  [
    "hex-trace-id",
    "tools/dev/src/observe/probe.test.ts",
    'export const traceId = "0123456789abcdeffedcba9876543210";',
  ],
  [
    "hex-span-id",
    "tools/dev/src/observe/probe.test.ts",
    'export const spanId = "0123456789abcdef";',
  ],
  ["github-token", "infra/cloudflare/src/probe-fixture.ts", githubTokenProbe],
  ["aws-access-key", "infra/cloudflare/src/probe-fixture.ts", awsAccessKeyProbe],
  [
    "base64-secret",
    "infra/cloudflare/src/probe-fixture.ts",
    'export const encoded = "VGhpc0lzQVJlYWxMb29raW5nQmFzZTY0U2VjcmV0MTIzNDU2";',
  ],
  [
    "real-looking-email",
    "infra/cloudflare/src/probe-fixture.ts",
    'export const mail = "ops@private-host.net";',
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
  [
    "authorization-header",
    "infra/cloudflare/src/probe-fixture.ts",
    'export const headers = { authorization: "Bearer RealLookingTokenValue123" };',
  ],
  [
    "api-token-assignment",
    "infra/cloudflare/src/probe-fixture.ts",
    'const access = { apiToken: "" }; access.apiToken = "RealLookingTokenValue123";',
  ],
  [
    "class-property-secret",
    "infra/cloudflare/src/probe-fixture.ts",
    'export class Probe { apiKey = "RealLookingTokenValue123"; }',
  ],
  [
    "array-element-host",
    "tools/dev/src/observe/probe.test.ts",
    'export const hosts = ["probe.private-host.net"];',
  ],
] as const;

const allowed = [
  ["tools/dev/src/observe/probe.ts", 'export const origin = "https://probe.private-host.net";'],
  [
    "tools/dev/src/observe/probe.test.ts",
    'export const origin = "http://app.example.ts.net:3001/";',
  ],
  ["tools/dev/src/observe/probe.test.ts", 'export const host = "mac-mini.example.ts.net";'],
  ["tools/dev/src/observe/probe.test.ts", 'export const origin = "http://127.0.0.1:3001/";'],
  ["tools/dev/src/observe/probe.test.ts", 'export const origin = "https://api.cloudflare.com/x";'],
  [
    "tools/dev/src/observe/probe.test.ts",
    'export const schema = "https://opentelemetry.io/schemas/1.20.0";',
  ],
  [
    "tools/dev/src/observe/probe.test.ts",
    'export const registry = "https://registry.npmjs.org/vite-plus";',
  ],
  ["tools/dev/src/observe/probe.test.ts", 'export const docs = "https://192.0.2.10/status";'],
  ["tools/dev/src/observe/probe.test.ts", 'export const event = "application.error";'],
  [
    "libs/db/src/probe-fixture.ts",
    'export const databaseId = "22222222-2222-4222-8222-222222222222";',
  ],
  [
    "tools/dev/src/observe/probe.test.ts",
    'export const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";',
  ],
  ["tools/dev/src/observe/probe.test.tsx", 'export const spanId = "0000000000000000";'],
  [
    "infra/cloudflare/src/probe-fixture.ts",
    'export const authSecret = "verification-test-secret-0123456789abcdef";',
  ],
  [
    "infra/cloudflare/src/probe-fixture.ts",
    'export const headers = { authorization: "Bearer stack-verification-not-a-real-token" };',
  ],
  ["infra/cloudflare/src/probe-fixture.ts", 'export const mail = "billing@example.com";'],
] as const;

describe("example values in tests and fixtures", () => {
  it.for(forbidden)("rejects a value that could be real: %s", ([_label, name, code]) => {
    expect.hasAssertions();
    expect(reported("example-values", { code, filename: name })).toBe(true);
  });

  it.for(allowed)("leaves self-declaring example values alone: %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reportedRules({ code, filename: name })).toStrictEqual([]);
  });
});
