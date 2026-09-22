import { describe, expect, test } from "vite-plus/test";

import { load, resolve, workersStub, workflowsStub } from "./cloudflare-workers-loader.ts";

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
    .extend("workersExact", () =>
      resolve("cloudflare:workers", emptyResolveContext, () => ({ url: "miss" })))
    .extend("workersSubpath", () =>
      resolve("cloudflare:workers/app", emptyResolveContext, () => ({ url: "miss" })),
    )
    .extend("workflowsExact", () =>
      resolve("cloudflare:workflows", emptyResolveContext, () => ({ url: "miss" })),
    )
    .extend("workflowsSubpath", () =>
      resolve("cloudflare:workflows/app", emptyResolveContext, () => ({ url: "miss" })),
    )
    .extend("forwarded", () =>
      resolve("effect", emptyResolveContext, () => ({ url: "effect-url" })),
    );

  it("stubs cloudflare:workers", ({ workersExact }) => {
    expect(workersExact).toStrictEqual({ shortCircuit: true, url: workersStub });
  });

  it("stubs cloudflare:workers subpaths", ({ workersSubpath }) => {
    expect(workersSubpath).toStrictEqual({ shortCircuit: true, url: workersStub });
  });

  it("stubs cloudflare:workflows", ({ workflowsExact }) => {
    expect(workflowsExact).toStrictEqual({ shortCircuit: true, url: workflowsStub });
  });

  it("stubs cloudflare:workflows subpaths", ({ workflowsSubpath }) => {
    expect(workflowsSubpath).toStrictEqual({ shortCircuit: true, url: workflowsStub });
  });

  it("forwards other specifiers", ({ forwarded }) => {
    expect(forwarded).toStrictEqual({ url: "effect-url" });
  });
});

describe("cloudflare workers load hook", () => {
  const it = test
    .extend("workersLoad", () =>
      load("cloudflare:workers", emptyLoadContext, (url, loadOptions) => ({
        format: loadOptions?.format ?? null,
        source: url,
      })))
    .extend("workflowsLoad", () =>
      load("cloudflare:workflows", emptyLoadContext, (url, loadOptions) => ({
        format: loadOptions?.format ?? null,
        source: url,
      })),
    )
    .extend("forwardedLoad", () =>
      load("file:///app.ts", emptyLoadContext, (url, loadOptions) => ({
        format: loadOptions?.format ?? null,
        source: url,
      })),
    );

  it("loads the workers stub for cloudflare:workers urls", ({ workersLoad }) => {
    expect(workersLoad).toStrictEqual({ format: "module", source: workersStub });
  });

  it("loads the workflows stub for cloudflare:workflows urls", ({ workflowsLoad }) => {
    expect(workflowsLoad).toStrictEqual({ format: "module", source: workflowsStub });
  });

  it("forwards other urls", ({ forwardedLoad }) => {
    expect(forwardedLoad).toStrictEqual({ format: null, source: "file:///app.ts" });
  });
});
