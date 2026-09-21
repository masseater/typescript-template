// oxlint-disable-next-line import/no-nodejs-modules
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { Writable } from "node:stream";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, it } from "vite-plus/test";

import {
  combinedOutput,
  binRelative,
  compileWorkspace,
  compilerFromResolution,
  diagnosticOf,
  effectTsgoBin,
  evaluateTypecheck,
  exitAfterFlush,
  exitInvokedCli,
  locateCompiler,
  isInvokedAsCli,
  maybeStart,
  missingExportCodes,
  parseBaseline,
  parseTscOutput,
  reportCliFailure,
  runEffectTypecheck,
  runInvokedCli,
  serializeBaseline,
  startEffectTypecheckCli,
  workspaceOf,
} from "./effect-typecheck.ts";

const fixtureTsconfig = JSON.stringify({
  compilerOptions: {
    allowImportingTsExtensions: true,
    isolatedModules: true,
    module: "ESNext",
    moduleResolution: "bundler",
    noEmit: true,
    skipLibCheck: true,
    strict: true,
  },
  include: ["./**/*.ts"],
});

const createFixture = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(path.join(tmpdir(), "effect-typecheck-"));
  writeFileSync(path.join(root, "tsconfig.json"), fixtureTsconfig);
  for (const [relative, source] of Object.entries(files)) {
    writeFileSync(path.join(root, relative), source);
  }
  return root;
};

const emptyBaseline = serializeBaseline({ version: 1, workspaces: {} });

const runGate = (asked: {
  readonly cwd: string;
  readonly args?: readonly string[];
  readonly baseline?: string;
  readonly repositoryRoot?: string;
}): { readonly baseline: string; readonly code: number; readonly printed: string } => {
  let stored = asked.baseline ?? emptyBaseline;
  let printed = "";
  const code = runEffectTypecheck({
    cwd: asked.cwd,
    repositoryRoot: asked.repositoryRoot ?? asked.cwd,
    args: asked.args ?? [],
    baselinePath: "baseline.json",
    compile: () => compileWorkspace(asked.cwd),
    readText: () => stored,
    writeText: (_file, text) => {
      stored = text;
    },
    print: (text) => {
      printed += text;
    },
  });
  return { baseline: stored, code, printed };
};

describe("effect typecheck gate", () => {
  it("fails a new assignability error that is not on the snapshot", () => {
    expect.hasAssertions();
    const cwd = createFixture({ "value.ts": 'export const value: number = "new";\n' });
    try {
      const compiled = compileWorkspace(cwd);
      const diagnostics = parseTscOutput(compiled.output);
      expect(diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "TS2322",
            file: "value.ts",
          }),
        ]),
      );
      const result = runGate({ cwd });
      expect(result.code).toBe(1);
      expect(result.printed).toMatch(/typecheck gate: 1 new diagnostics/u);
      expect(result.printed).toMatch(/error TS2322/u);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("keeps a snapshotted assignability error from failing the gate", () => {
    expect.hasAssertions();
    const cwd = createFixture({ "value.ts": 'export const value: number = "new";\n' });
    try {
      const written = runGate({ cwd, args: ["--write"] });
      expect(written.code).toBe(0);
      const parsed = parseBaseline(written.baseline);
      expect(parsed.workspaces["."]?.some((entry) => entry.code === "TS2322")).toBe(true);
      const result = runGate({ cwd, baseline: written.baseline });
      expect(result.code).toBe(0);
      expect(result.printed).not.toMatch(/typecheck gate:/u);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("fails a missing named export even after that diagnostic is snapshotted", () => {
    expect.hasAssertions();
    const cwd = createFixture({
      "empty.ts": "export const present = 1;\n",
      "missing.ts": 'import { absent } from "./empty.ts";\nexport const value = absent;\n',
    });
    try {
      const compiled = compileWorkspace(cwd);
      expect(parseTscOutput(compiled.output)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "TS2305",
            file: "missing.ts",
          }),
        ]),
      );
      const written = runGate({ cwd, args: ["--write"] });
      expect(written.code).toBe(1);
      expect(written.printed).toMatch(/missing-export errors/u);
      const listed = serializeBaseline({
        version: 1,
        workspaces: {
          ".": parseTscOutput(compiled.output).map((diagnostic) => ({
            ...diagnostic,
            count: 1,
          })),
        },
      });
      const result = runGate({ cwd, baseline: listed });
      expect(result.code).toBe(1);
      expect(result.printed).toMatch(/missing-export errors/u);
      expect(
        evaluateTypecheck(".", parseTscOutput(compiled.output), parseBaseline(listed)).ok,
      ).toBe(false);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("treats diagnostics that differ only by checkout path as the same diagnostic", () => {
    expect.hasAssertions();
    const checkout = path.join(repositoryRoot, ".local", "effect-typecheck-checkout");
    const sibling = `${checkout}-other`;
    const output = `src/monitor-fixture.ts(48,7): error TS4023: Exported variable 'ProbeMonitor' has or is using name 'Alert' from external module "${checkout}/libs/monitor/src/index" but cannot be named.\n`;
    const baseline = serializeBaseline({
      version: 1,
      workspaces: {
        ".": [
          {
            file: "src/monitor-fixture.ts",
            code: "TS4023",
            message: `Exported variable 'ProbeMonitor' has or is using name 'Alert' from external module "<repo>/libs/monitor/src/index" but cannot be named.`,
            count: 1,
          },
        ],
      },
    });
    let printed = "";
    let stored = emptyBaseline;
    expect(
      runEffectTypecheck({
        cwd: checkout,
        repositoryRoot: checkout,
        args: [],
        baselinePath: "baseline.json",
        compile: () => ({ output, status: 1 }),
        readText: () => baseline,
        writeText: () => undefined,
        print: (text) => {
          printed += text;
        },
      }),
    ).toBe(0);
    expect(printed).not.toMatch(/typecheck gate:/u);
    expect(
      runEffectTypecheck({
        cwd: checkout,
        repositoryRoot: checkout,
        args: ["--write"],
        baselinePath: "baseline.json",
        compile: () => ({
          output: `src/a.ts(1,1): error TS4023: from "${checkout}/libs/a" and "${sibling}/libs/a"\n`,
          status: 1,
        }),
        readText: () => emptyBaseline,
        writeText: (_file, text) => {
          stored = text;
        },
        print: () => undefined,
      }),
    ).toBe(0);
    expect(stored).toContain("<repo>/libs/a");
    expect(stored).toContain(`${sibling}/libs/a`);
    expect(stored).not.toContain(`${checkout}/libs/a`);
  });

  it("fails when a snapshotted diagnostic disappears", () => {
    expect.hasAssertions();
    const cwd = createFixture({ "value.ts": "export const value = 1;\n" });
    try {
      const baseline = serializeBaseline({
        version: 1,
        workspaces: {
          ".": [
            {
              file: "value.ts",
              code: "TS2322",
              message: "Type 'string' is not assignable to type 'number'.",
              count: 1,
            },
          ],
        },
      });
      const result = runGate({ cwd, baseline });
      expect(result.code).toBe(1);
      expect(result.printed).toMatch(/baselined diagnostics are gone/u);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("fails when the same snapshotted diagnostic appears an extra time", () => {
    expect.hasAssertions();
    const cwd = createFixture({
      "value.ts": 'export const first: number = "a";\nexport const second: number = "b";\n',
    });
    try {
      const compiled = compileWorkspace(cwd);
      const doubled = runGate({ cwd });
      expect(doubled.printed).toMatch(/\u00d72/u);
      const [diagnostic] = parseTscOutput(compiled.output);
      expect(diagnostic).toBeDefined();
      const baseline = serializeBaseline({
        version: 1,
        workspaces: {
          ".": [
            {
              file: diagnostic?.file ?? "value.ts",
              code: diagnostic?.code ?? "TS2322",
              message: diagnostic?.message ?? "",
              count: 1,
            },
          ],
        },
      });
      const result = runGate({ cwd, baseline });
      expect(result.code).toBe(1);
      expect(result.printed).toMatch(/new diagnostics/u);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("rejects unknown flags and a compiler that exits without diagnostics", () => {
    expect.hasAssertions();
    let printed = "";
    expect(
      runEffectTypecheck({
        cwd: repositoryRoot,
        repositoryRoot,
        args: ["--rewrite"],
        baselinePath: "baseline.json",
        compile: () => ({ output: "", status: 0 }),
        readText: () => emptyBaseline,
        writeText: () => undefined,
        print: (text) => {
          printed += text;
        },
      }),
    ).toBe(1);
    expect(printed).toMatch(/Unknown option --rewrite/u);
    printed = "";
    expect(
      runEffectTypecheck({
        cwd: repositoryRoot,
        repositoryRoot,
        args: [],
        baselinePath: "baseline.json",
        compile: () => ({ output: "effect-tsgo: not found", status: 1 }),
        readText: () => emptyBaseline,
        writeText: () => undefined,
        print: (text) => {
          printed += text;
        },
      }),
    ).toBe(1);
    expect(printed).toMatch(/compiler exited without diagnostics/u);
  });

  it("names workspaces from the repository root and keeps the committed snapshot canonical", () => {
    expect.hasAssertions();
    expect(workspaceOf(repositoryRoot, repositoryRoot)).toBe(".");
    expect(workspaceOf(path.join(repositoryRoot, "libs/vite-config"), repositoryRoot)).toBe(
      "libs/vite-config",
    );
    expect(() => workspaceOf(path.join(repositoryRoot, ".."), repositoryRoot)).toThrow(
      /is outside/u,
    );
    const committed = readFileSync(
      path.join(repositoryRoot, "libs/vite-config/src/effect-typecheck-baseline.json"),
      "utf8",
    );
    const parsed = parseBaseline(committed);
    expect(serializeBaseline(parsed)).toBe(committed);
    const forbidden = new Set<string>(missingExportCodes);
    expect(
      Object.values(parsed.workspaces)
        .flat()
        .filter((entry) => forbidden.has(entry.code)),
    ).toStrictEqual([]);
    expect(
      parseTscOutput("error TS2688: Cannot find type definition file for 'node'.\n"),
    ).toStrictEqual([
      {
        file: "",
        code: "TS2688",
        message: "Cannot find type definition file for 'node'.",
      },
    ]);
    expect(
      parseTscOutput(
        "src/value.ts:1:7 - error TS2322: Type 'string' is not assignable to type 'number'.\n",
      ),
    ).toStrictEqual([
      {
        file: "src/value.ts",
        code: "TS2322",
        message: "Type 'string' is not assignable to type 'number'.",
      },
    ]);
  });

  it("covers the packaged entry, a missing compiler, and CLI failures", () => {
    expect.hasAssertions();
    const modulePath = fileURLToPath(new URL("./effect-typecheck.ts", import.meta.url));
    expect(effectTsgoBin()).toMatch(/effect-tsgo\.cjs$/u);
    expect(binRelative({ bin: { "effect-tsgo": "./dist/effect-tsgo.cjs" } })).toBe(
      "./dist/effect-tsgo.cjs",
    );
    expect(() => binRelative({})).toThrow(/missing the effect-tsgo bin/u);
    expect(compilerFromResolution({ status: 0, stdout: "/tsc\n", stderr: "" })).toBe("/tsc");
    expect(() => compilerFromResolution({ status: 0, stdout: null, stderr: null })).toThrow(
      /compiler not found/u,
    );
    expect(() => compilerFromResolution({ status: 1, stdout: "", stderr: "no" })).toThrow(/no/u);
    expect(() => compilerFromResolution({ status: 1, stdout: "", stderr: "" })).toThrow(
      /compiler not found/u,
    );
    expect(locateCompiler(process.env).length).toBeGreaterThan(0);
    expect(() => locateCompiler({ ...process.env, PATH: "/var/empty" })).not.toThrow();
    expect(isInvokedAsCli(undefined, modulePath)).toBe(false);
    expect(isInvokedAsCli(modulePath, modulePath)).toBe(true);
    expect(maybeStart("/tmp/not-the-cli", modulePath)).toBe(false);
    expect(maybeStart(modulePath, modulePath)).toBe(true);
    expect(startEffectTypecheckCli()).toBe(0);
    expect(
      startEffectTypecheckCli({ cwd: path.join(repositoryRoot, "tools/load"), args: ["--write"] }),
    ).toBe(0);
    const missing = compileWorkspace(repositoryRoot, process.env, () => {
      throw new Error("compiler missing");
    });
    expect(missing.status).not.toBe(0);
    expect(missing.output).toMatch(/compiler missing/u);
    expect(
      compileWorkspace(repositoryRoot, process.env, () => {
        throw "no";
      }).output,
    ).toMatch(/compiler not found/u);
    expect(
      compileWorkspace(path.join(repositoryRoot, "tools/load"), {
        ...process.env,
        PATH: "/var/empty",
      }).status,
    ).toBe(0);
    expect(
      startEffectTypecheckCli({ cwd: path.join(repositoryRoot, "tools/load"), args: [] }),
    ).toBe(0);
    runInvokedCli(() => {
      throw new Error("boom");
    });
    expect(process.exitCode).toBe(1);
    runInvokedCli(() => {
      throw "no";
    });
    reportCliFailure(new Error("listed"));
    expect(process.exitCode).toBe(1);
    expect(combinedOutput({ stdout: null, stderr: null, status: null })).toStrictEqual({
      output: "",
      status: 1,
    });
    expect(diagnosticOf(undefined, "TS2322", "x")).toStrictEqual([]);
    expect(
      runEffectTypecheck({
        cwd: path.join(repositoryRoot, "tools/load"),
        repositoryRoot,
        args: [],
        baselinePath: path.join(
          repositoryRoot,
          "libs/vite-config/src/effect-typecheck-baseline.json",
        ),
        compile: () => ({ output: "ok", status: 0 }),
        readText: (file) => readFileSync(file, "utf8"),
        writeText: () => undefined,
        print: () => undefined,
      }),
    ).toBe(0);
  });

  it("runs the packaged gate against a real compiler", () => {
    expect.hasAssertions();
    mkdirSync(path.join(repositoryRoot, ".local"), { recursive: true });
    const cwd = mkdtempSync(path.join(repositoryRoot, ".local", "effect-typecheck-"));
    writeFileSync(path.join(cwd, "tsconfig.json"), fixtureTsconfig);
    writeFileSync(path.join(cwd, "value.ts"), 'export const value: number = "new";\n');
    const gate = path.join(repositoryRoot, "node_modules/.bin/check-effect-typecheck");
    try {
      const result = spawnSync("sh", ["-c", `${JSON.stringify(gate)} && echo SHOULD_NOT_RUN`], {
        cwd,
        encoding: "utf8",
        env: process.env,
      });
      expect(result.status).toBe(1);
      expect(`${result.stdout ?? ""}${result.stderr ?? ""}`).toMatch(/error TS2322/u);
      expect(`${result.stdout ?? ""}${result.stderr ?? ""}`).toMatch(/new diagnostics/u);
      expect(`${result.stdout ?? ""}${result.stderr ?? ""}`).not.toContain("SHOULD_NOT_RUN");
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("exits the process with the gate status instead of only recording it", async () => {
    expect.hasAssertions();
    const modulePath = fileURLToPath(new URL("./effect-typecheck.ts", import.meta.url));
    const exited: number[] = [];
    const record = (code: number): void => {
      exited.push(code);
    };
    expect(exitInvokedCli("/tmp/not-the-cli", modulePath, () => 1, record)).toBe(false);
    expect(exitInvokedCli(modulePath, modulePath, () => 1, record)).toBe(true);
    expect(
      exitInvokedCli(
        modulePath,
        modulePath,
        () => {
          throw new Error("boom");
        },
        record,
      ),
    ).toBe(true);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(exited).toStrictEqual([1, 1]);
    process.exitCode = undefined;
  });

  it("flushes stdout before exiting so the gate report is not truncated", async () => {
    expect.hasAssertions();
    const exited: number[] = [];
    const record = (code: number): void => {
      exited.push(code);
    };
    const open = (): Writable =>
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
    const closed = open();
    closed.destroy();
    exitAfterFlush(1, record, []);
    exitAfterFlush(2, record, [closed]);
    expect(exited).toStrictEqual([1, 2]);
    exitAfterFlush(3, record, [open(), open()]);
    expect(exited).toStrictEqual([1, 2]);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(exited).toStrictEqual([1, 2, 3]);
    const script = `import { exitAfterFlush } from ${JSON.stringify(fileURLToPath(new URL("./effect-typecheck.ts", import.meta.url)))};
process.stdout.write("A".repeat(200000));
process.stdout.write("END");
exitAfterFlush(1, process.exit, [process.stdout, process.stderr]);
`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout ?? "").toHaveLength(200003);
    expect((result.stdout ?? "").endsWith("END")).toBe(true);
  });

  it("fails the vite task when the gate fails and does not run the next command", () => {
    expect.hasAssertions();
    mkdirSync(path.join(repositoryRoot, ".local"), { recursive: true });
    const fixture = mkdtempSync(path.join(repositoryRoot, ".local", "effect-typecheck-vp-"));
    const project = mkdtempSync(path.join(tmpdir(), "effect-typecheck-vp-"));
    writeFileSync(path.join(fixture, "tsconfig.json"), fixtureTsconfig);
    writeFileSync(path.join(fixture, "value.ts"), 'export const value: number = "new";\n');
    const gate = path.join(repositoryRoot, "node_modules/.bin/check-effect-typecheck");
    const runner = path.join(project, "run-gate.mjs");
    writeFileSync(
      path.join(project, "package.json"),
      `${JSON.stringify({ name: "effect-typecheck-vp", private: true, type: "module" })}\n`,
    );
    writeFileSync(
      runner,
      `import { spawnSync } from "node:child_process";
const result = spawnSync(${JSON.stringify(gate)}, {
  cwd: ${JSON.stringify(fixture)},
  encoding: "utf8",
  env: process.env,
});
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
`,
    );
    writeFileSync(
      path.join(project, "vite.config.ts"),
      `import { defineConfig } from "vite-plus";
export default defineConfig({
  run: {
    tasks: {
      "check:effect:gate": {
        command: ${JSON.stringify(`node ${JSON.stringify(runner)}`)},
      },
      "check:effect": {
        command: "echo SECOND_SHOULD_NOT_RUN",
        dependsOn: ["check:effect:gate"],
      },
    },
  },
});
`,
    );
    try {
      const result = spawnSync("vp", ["run", "--no-cache", "check:effect"], {
        cwd: project,
        encoding: "utf8",
        env: process.env,
      });
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      expect(result.status).not.toBe(0);
      expect(output).toMatch(/typecheck gate:/u);
      expect(output).not.toContain("SECOND_SHOULD_NOT_RUN");
    } finally {
      rmSync(fixture, { force: true, recursive: true });
      rmSync(project, { force: true, recursive: true });
    }
  });
});
