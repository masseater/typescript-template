import { describe, expect, it } from "vite-plus/test";

import { assertCoreNotPublic, corePublicViolation } from "./core-guard.ts";

import type { StackInventory } from "./inventory.ts";

const privateWorkerDeclared = {
  bundle: false,
  name: "template-core",
  workersDev: { enabled: false, previewsEnabled: false },
};
const privateWorker = {
  adopt: false,
  bindings: [],
  declared: privateWorkerDeclared,
  removalPolicy: "destroy",
  type: "Cloudflare.Worker",
};
const privateCore: StackInventory = {
  dependencies: [],
  name: "template-core",
  resources: {
    Worker: privateWorker,
  },
};

describe("corePublicViolation", () => {
  it("rejects a custom domain on core", () => {
    expect(
      corePublicViolation({
        domain: { name: "core.example.com", zoneId: "zone" },
        workersDev: { enabled: false },
      }),
    ).toBe("core_worker_has_custom_domain");
  });

  it("rejects workers.dev on core", () => {
    expect(corePublicViolation({ workersDev: { enabled: true } })).toBe(
      "core_worker_has_workers_dev",
    );
  });

  it("rejects the alchemy default when workers.dev is omitted", () => {
    expect(corePublicViolation({})).toBe("core_worker_has_workers_dev");
  });

  it("rejects workers.dev preview urls", () => {
    expect(corePublicViolation({ workersDev: { enabled: false, previewsEnabled: true } })).toBe(
      "core_worker_has_workers_dev",
    );
  });

  it("accepts workers.dev disabled as a boolean", () => {
    expect(corePublicViolation({ workersDev: false })).toBeUndefined();
  });

  it("accepts a worker with no public entry", () => {
    expect(
      corePublicViolation({
        workersDev: { enabled: false, previewsEnabled: false },
      }),
    ).toBeUndefined();
  });
});

describe("assertCoreNotPublic", () => {
  it("accepts the expected private core inventory", () => {
    expect(assertCoreNotPublic(privateCore)).toBeUndefined();
  });

  it("rejects a core stack that gained a domain", () => {
    expect(
      assertCoreNotPublic({
        ...privateCore,
        resources: {
          Worker: {
            ...privateWorker,
            declared: {
              ...privateWorkerDeclared,
              domain: { name: "core.example.com", zoneId: "zone" },
            },
          },
        },
      }),
    ).toBe("core_worker_has_custom_domain");
  });
});
