import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";

const mockBypasses = [
  ["import-alias", 'import { vi as tools } from "vitest"; tools.mock("owned");'],
  ["rest-alias", 'import { vi } from "vitest"; const { ...tools } = vi; tools.mock("owned");'],
  [
    "destructure-assignment",
    'import { vi } from "vitest"; let replace; ({ mock: replace } = vi); replace("owned");',
  ],
  ["namespace", 'import * as tools from "vitest"; tools.vi.fn();'],
  [
    "namespace-destructure",
    'import * as tools from "vitest"; const { vi: kit } = tools; kit.spyOn({}, "method");',
  ],
  [
    "nested-destructure",
    'import * as tools from "vitest"; const { vi: { mock: replace } } = tools; replace("owned");',
  ],
  [
    "method-destructure",
    'import { vi } from "vitest"; const { mock: replace } = vi; replace("owned");',
  ],
  [
    "alias-chain",
    'import { vi as first } from "vitest"; const second = first; const third = second; third.doMock("owned");',
  ],
  [
    "computed-method",
    'import { vi as tools } from "vitest"; const key = "stub" + "Global"; tools[key]("fetch", () => null);',
  ],
  ["optional-method", 'import { vi as tools } from "vitest"; tools?.fn();'],
  ["require-destructure", 'const { vi: tools } = require("vitest"); tools.fn();'],
  ["dynamic-destructure", 'const { vi: tools } = await import("vitest"); tools.fn();'],
  ["reassignment", 'import { vi } from "vitest"; let tools; tools = vi; tools.fn();'],
  ["jest-alias", 'import { jest as tools } from "@jest/globals"; tools.spyOn({}, "method");'],
  ["direct-spy-import", 'import { fn as replace } from "@vitest/spy"; replace();'],
  ["vite-plus-import", 'import { vi as tools } from "vite-plus/test"; tools.mock("owned");'],
  [
    "vite-plus-namespace",
    'import * as tools from "vite-plus/test"; const { vi: kit } = tools; kit.fn();',
  ],
  ["vite-plus-dynamic", 'const { vi: tools } = await import("vite-plus/test"); tools.fn();'],
  [
    "vite-plus-spy-import",
    'import { fn as replace } from "vite-plus/test/plugins/spy"; replace();',
  ],
  ["node-test-mock", 'import { mock as tools } from "node:test"; tools.fn();'],
] as const;

const environmentBypasses = [
  ["process-computed", 'export const value = process["env"]["SECRET"];'],
  ["process-alias", "const runtime = process; export const value = runtime.env;"],
  ["rest-process", "const { ...runtime } = process; export const value = runtime.env;"],
  ["destructure-assignment", "let values; ({ env: values } = process); export { values };"],
  ["meta-assignment", "let values; ({ env: values } = import.meta); export { values };"],
  ["process-destructure", "export const { env: values } = process;"],
  ["nested-destructure", "export const { env: { SECRET: value } } = process;"],
  ["process-import", 'import runtime from "node:process"; export const value = runtime.env;'],
  ["named-import", 'import { env as values } from "node:process"; export { values };'],
  ["process-reexport", 'export { env as values } from "node:process";'],
  ["process-require", 'const { env: values } = require("process"); export { values };'],
  ["global-process", "export const value = globalThis.process.env;"],
  [
    "global-destructure",
    "const { process: runtime } = globalThis; export const value = runtime.env;",
  ],
  ["meta-env", "export const value = import.meta.env;"],
  ["meta-computed", 'export const value = import.meta["env"]["PUBLIC_SECRET"];'],
  ["meta-alias", "const meta = import.meta; export const value = meta.env;"],
  ["meta-destructure", "export const { env: values } = import.meta;"],
  ["meta-nested", "export const { env: { SECRET: value } } = import.meta;"],
] as const;

describe("project lint rules on mock and environment bypasses", () => {
  it.for(mockBypasses)("rejects mock bypass: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("no-internal-mocks", "probe.ts", code)).toBe(true);
  });

  it.for(environmentBypasses)("rejects environment bypass: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("environment-boundary", "libs/shared/src/probe.ts", code)).toBe(true);
  });
});
