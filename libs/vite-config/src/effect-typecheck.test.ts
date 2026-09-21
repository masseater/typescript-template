// oxlint-disable-next-line import/no-nodejs-modules
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
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
    try {
      const result = spawnSync(
        path.join(repositoryRoot, "node_modules/.bin/check-effect-typecheck"),
        [],
        {
          cwd,
          encoding: "utf8",
          env: process.env,
        },
      );
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toMatch(/error TS2322/u);
      expect(`${result.stdout}${result.stderr}`).toMatch(/new diagnostics/u);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });
});
