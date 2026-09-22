import { describe, expect, it } from "vite-plus/test";

import { reported, reportedRules } from "./lint-harness.ts";

const testFile = "libs/shared/src/probe.test.ts";

const outOfGraphDependencies = [
  ["child-process", 'import { spawn } from "node:child_process"; spawn("node");'],
  ["child-process-bare", 'import * as child from "child_process"; child.execFileSync("node");'],
  ["child-process-dynamic", 'const { spawn } = await import("node:child_process");'],
  ["child-process-require", 'const child = require("node:child_process");'],
  ["child-process-builtin", 'const child = process.getBuiltinModule("node:child_process");'],
  ["child-process-reexport", 'export { spawn } from "node:child_process";'],
  ["worker-thread", 'import { Worker } from "node:worker_threads"; new Worker("./probe.ts");'],
  ["meta-url", 'const file = new URL("../fixture.json", import.meta.url);'],
  ["meta-dirname", "const directory = import.meta.dirname;"],
  ["meta-filename", "const file = import.meta.filename;"],
  ["meta-resolve", 'const entry = import.meta.resolve("./probe.ts");'],
  ["meta-computed", 'const file = import.meta["url"];'],
  ["meta-alias", "const meta = import.meta; const file = meta.url;"],
  ["meta-destructure", "const { url } = import.meta;"],
  ["meta-assignment", "let file; ({ url: file } = import.meta);"],
  ["raw-import", 'import text from "./fixture.yaml?raw";'],
  ["raw-dynamic", 'const text = await import("./fixture.yaml?raw");'],
  ["glob-query", 'import.meta.glob("./*.yaml", { eager: true, query: "?raw" });'],
  ["glob-computed-query", 'import.meta.glob("./*.yaml", { ["query"]: "?raw" });'],
  [
    "glob-spread-options",
    'const options = { query: "?raw" }; import.meta.glob("./*.yaml", { ...options });',
  ],
  [
    "glob-dynamic-options",
    'const options = { query: "?raw" }; import.meta.glob("./*.yaml", options);',
  ],
  ["glob-pattern-query", 'import.meta.glob(["./*.yaml?raw"]);'],
  ["process-cwd", "const root = process.cwd();"],
  ["process-import-cwd", 'import { cwd } from "node:process"; const root = cwd();'],
  ["process-alias-cwd", "const runtime = process; const root = runtime.cwd();"],
] as const;

const inGraphDependencies = [
  ["glob", 'const files = import.meta.glob("./fixtures/*.json", { eager: true });'],
  ["json-import", 'import manifest from "../../../../../../package.json" with { type: "json" };'],
  [
    "temporary-files",
    'import { mkdtemp } from "node:fs/promises"; import { tmpdir } from "node:os"; await mkdtemp(tmpdir());',
  ],
] as const;

describe("project lint rules on the test import graph", () => {
  it.for(outOfGraphDependencies)("rejects out-of-graph test dependency: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("test-import-graph", { code, filename: testFile })).toBe(true);
  });

  it.for(inGraphDependencies)("allows import-graph test dependency: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reportedRules({ code, filename: testFile })).toStrictEqual([]);
  });

  it("allows out-of-graph dependencies outside tests", () => {
    expect.hasAssertions();
    expect(
      reportedRules({
        code: 'import { spawn } from "node:child_process"; spawn(new URL(".", import.meta.url));',
        filename: "tools/dev/src/features/dev/cli.ts",
      }),
    ).toStrictEqual([]);
  });
});
