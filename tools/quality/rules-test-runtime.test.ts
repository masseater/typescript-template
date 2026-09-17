import { describe, expect, it } from "vite-plus/test";
import { reported } from "./lint-harness.ts";
import { workerTestSuffix } from "./test-runtime.ts";

const workerTest = `libs/shared/src/probe${workerTestSuffix}`;
const nodeTest = "libs/shared/src/probe.test.ts";

const nodeRuntimeDependencies = [
  ["builtin", 'import { readFile } from "node:fs/promises"; await readFile("probe");'],
  ["msw", 'import { setupServer } from "msw/node"; setupServer();'],
  ["miniflare", 'import { Miniflare } from "miniflare"; new Miniflare({});'],
  ["wrangler", 'import { getPlatformProxy } from "wrangler"; await getPlatformProxy();'],
  ["drizzle-kit", 'import { generateMigration } from "drizzle-kit/payload/sqlite";'],
  ["dynamic", 'const { readFile } = await import("node:fs/promises");'],
  ["reexport", 'export { readFile } from "node:fs/promises";'],
] as const;

const workerRuntimeDependencies = [
  ["bindings", 'import { env } from "cloudflare:workers"; await env.DB.prepare("SELECT 1").run();'],
  ["helpers", 'import { reset } from "cloudflare:test"; await reset();'],
  ["dynamic", 'const { env } = await import("cloudflare:workers");'],
] as const;

describe("the name of a test file decides which runtime runs it", () => {
  it.for(nodeRuntimeDependencies)("rejects %s in a worker test", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("test-runtime", workerTest, code)).toBe(true);
  });

  it.for(workerRuntimeDependencies)("rejects %s in a node test", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("test-runtime", nodeTest, code)).toBe(true);
  });

  it.for(workerRuntimeDependencies)("allows %s in a worker test", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("test-runtime", workerTest, code)).toBe(false);
  });

  it.for(nodeRuntimeDependencies)("allows %s in a node test", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("test-runtime", nodeTest, code)).toBe(false);
  });

  it("leaves files that are not tests alone", () => {
    expect.hasAssertions();
    expect(
      reported(
        "test-runtime",
        "libs/shared/src/probe.ts",
        'import { env } from "cloudflare:workers";',
      ),
    ).toBe(false);
  });
});
