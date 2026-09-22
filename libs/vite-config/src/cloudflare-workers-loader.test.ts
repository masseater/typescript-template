import { describe, expect, test } from "vite-plus/test";

import { load, resolve } from "./cloudflare-workers-loader.ts";

import type { LoadHookContext, ResolveHookContext } from "node:module";

const emptyResolveContext = {
  conditions: [],
  importAttributes: {},
  parentURL: undefined,
} satisfies ResolveHookContext;
const emptyLoadContext = {
  conditions: [],
  format: undefined,
  importAttributes: {},
} satisfies LoadHookContext;

describe("cloudflare workers resolve hook", () => {
  const it = test
    .extend("workersExact", () => {
      const resolved = resolve("cloudflare:workers", emptyResolveContext, () => ({ url: "miss" }));
      return (
        resolved.shortCircuit === true && resolved.url.endsWith("/cloudflare-workers-stub.mjs")
      );
    })
    .extend("workersSubpath", () => {
      const resolved = resolve("cloudflare:workers/app", emptyResolveContext, () => ({
        url: "miss",
      }));
      return (
        resolved.shortCircuit === true && resolved.url.endsWith("/cloudflare-workers-stub.mjs")
      );
    })
    .extend("workflowsExact", () => {
      const resolved = resolve("cloudflare:workflows", emptyResolveContext, () => ({
        url: "miss",
      }));
      return (
        resolved.shortCircuit === true && resolved.url.endsWith("/cloudflare-workflows-stub.mjs")
      );
    })
    .extend("workflowsSubpath", () => {
      const resolved = resolve("cloudflare:workflows/app", emptyResolveContext, () => ({
        url: "miss",
      }));
      return (
        resolved.shortCircuit === true && resolved.url.endsWith("/cloudflare-workflows-stub.mjs")
      );
    })
    .extend("forwarded", () =>
      resolve("effect", emptyResolveContext, () => ({ url: "effect-url" })),
    );

  it("stubs cloudflare:workers", ({ workersExact }) => {
    expect(workersExact).toBe(true);
  });

  it("stubs cloudflare:workers subpaths", ({ workersSubpath }) => {
    expect(workersSubpath).toBe(true);
  });

  it("stubs cloudflare:workflows", ({ workflowsExact }) => {
    expect(workflowsExact).toBe(true);
  });

  it("stubs cloudflare:workflows subpaths", ({ workflowsSubpath }) => {
    expect(workflowsSubpath).toBe(true);
  });

  it("forwards other specifiers", ({ forwarded }) => {
    expect(forwarded).toStrictEqual({ url: "effect-url" });
  });
});

describe("cloudflare workers load hook", () => {
  const it = test
    .extend("workersLoad", () => {
      const loaded = load("cloudflare:workers", emptyLoadContext, (url, loadOptions) => ({
        format: loadOptions?.format ?? null,
        source: url,
      }));
      return (
        loaded.format === "module" &&
        typeof loaded.source === "string" &&
        loaded.source.endsWith("/cloudflare-workers-stub.mjs")
      );
    })
    .extend("workflowsLoad", () => {
      const loaded = load("cloudflare:workflows", emptyLoadContext, (url, loadOptions) => ({
        format: loadOptions?.format ?? null,
        source: url,
      }));
      return (
        loaded.format === "module" &&
        typeof loaded.source === "string" &&
        loaded.source.endsWith("/cloudflare-workflows-stub.mjs")
      );
    })
    .extend("forwardedLoad", () =>
      load("file:///app.ts", emptyLoadContext, (url, loadOptions) => ({
        format: loadOptions?.format ?? null,
        source: url,
      })),
    );

  it("loads the workers stub for cloudflare:workers urls", ({ workersLoad }) => {
    expect(workersLoad).toBe(true);
  });

  it("loads the workflows stub for cloudflare:workflows urls", ({ workflowsLoad }) => {
    expect(workflowsLoad).toBe(true);
  });

  it("forwards other urls", ({ forwardedLoad }) => {
    expect(forwardedLoad).toStrictEqual({ format: null, source: "file:///app.ts" });
  });
});
