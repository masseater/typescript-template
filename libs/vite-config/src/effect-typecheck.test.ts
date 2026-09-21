import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, it } from "vite-plus/test";

import { runEffectTypecheck } from "./effect-typecheck.ts";

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

const emptyBaseline = `${JSON.stringify({ version: 1, workspaces: {} }, null, 2)}\n`;

const missingExportCodes = ["TS2305", "TS2459", "TS2460", "TS2614", "TS2724"] as const;

const pathWithBins = (): NodeJS.ProcessEnv => {
  const bins = path.join(repositoryRoot, "node_modules/.bin");
  return {
    ...process.env,
    PATH: [bins, process.env["PATH"]]
      .filter((entry) => entry !== undefined && entry !== "")
      .join(path.delimiter),
  };
};

const compileFixture = (cwd: string): { readonly output: string; readonly status: number } => {
  const env = pathWithBins();
  const packageJson = createRequire(import.meta.url).resolve("@effect/tsgo/package.json");
  const manifest = JSON.parse(readFileSync(packageJson, "utf8")) as {
    readonly bin?: Readonly<Record<string, string>>;
  };
  const tsgo = path.join(path.dirname(packageJson), manifest.bin?.["effect-tsgo"] ?? "");
  const located = spawnSync(process.execPath, [tsgo, "get-exe-path"], { encoding: "utf8", env });
  const executable = (located.stdout ?? "").trim();
  const compiled = spawnSync(executable, ["--pretty", "false", "--noEmit", "-p", "tsconfig.json"], {
    cwd,
    encoding: "utf8",
    env,
  });
  return {
    output: `${compiled.stdout ?? ""}${compiled.stderr ?? ""}`,
    status: compiled.status ?? 1,
  };
};

const createFixture = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(path.join(tmpdir(), "effect-typecheck-"));
  writeFileSync(path.join(root, "tsconfig.json"), fixtureTsconfig);
  for (const [relative, source] of Object.entries(files)) {
    writeFileSync(path.join(root, relative), source);
  }
  return root;
};

const runGate = (asked: {
  readonly cwd: string;
  readonly args?: readonly string[];
  readonly baseline?: string;
  readonly repositoryRoot?: string;
  readonly compile?: () => { readonly output: string; readonly status: number };
}): { readonly baseline: string; readonly code: number; readonly printed: string } => {
  let stored = asked.baseline ?? emptyBaseline;
  let printed = "";
  const code = runEffectTypecheck({
    cwd: asked.cwd,
    repositoryRoot: asked.repositoryRoot ?? asked.cwd,
    args: asked.args ?? [],
    baselinePath: "baseline.json",
    compile: asked.compile ?? (() => compileFixture(asked.cwd)),
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
  it("keeps only diagnostics that belong to the workspace that ran the gate", () => {
    expect.hasAssertions();
    const written = runGate({
      cwd: "/repo/apps/service-member",
      repositoryRoot: "/repo",
      args: ["--write"],
      compile: () => ({
        output: [
          "src/app.ts(1,1): error TS4111: local",
          "../../libs/auth/src/session.ts(1,1): error TS4111: foreign relative",
          "<repo>/libs/monitor/src/monitor-fixture.ts(1,1): error TS4023: foreign checkout",
          "<repo>/apps/service-member/src/routes.ts(1,1): error TS2322: owned checkout",
          "error TS0000: compiler",
        ].join("\n"),
        status: 1,
      }),
    });
    expect(written.code).toBe(0);
    const snapshot = JSON.parse(written.baseline) as {
      readonly workspaces: Readonly<Record<string, readonly { readonly file: string }[]>>;
    };
    expect(snapshot.workspaces["apps/service-member"]?.map((entry) => entry.file)).toStrictEqual([
      "",
      "<repo>/apps/service-member/src/routes.ts",
      "src/app.ts",
    ]);
  });

  it("does not fail the gate on type errors in another workspace's sources", () => {
    expect.hasAssertions();
    const cwd = createFixture({ "value.ts": "export const value: number = 1;\n" });
    const other = path.join(path.dirname(cwd), "other-workspace");
    try {
      mkdirSync(other);
      writeFileSync(path.join(other, "broken.ts"), 'export const value: number = "new";\n');
      const listed = `${JSON.stringify(
        {
          version: 1,
          workspaces: {
            [path.relative(path.dirname(cwd), other)]: [
              {
                file: "../other-workspace/broken.ts",
                code: "TS2322",
                message: "Type 'string' is not assignable to type 'number'.",
                count: 1,
              },
            ],
          },
        },
        null,
        2,
      )}\n`;
      const result = runGate({
        cwd,
        baseline: listed,
        repositoryRoot: path.dirname(cwd),
      });
      expect(result.code).toBe(0);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
      rmSync(other, { force: true, recursive: true });
    }
  });

  it("fails a new assignability error that is not on the snapshot", () => {
    expect.hasAssertions();
    const cwd = createFixture({ "value.ts": 'export const value: number = "new";\n' });
    try {
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
      const parsed = JSON.parse(written.baseline) as {
        readonly workspaces: Readonly<Record<string, readonly { readonly code: string }[]>>;
      };
      expect(parsed.workspaces["."]?.some((entry) => entry.code === "TS2322")).toBe(true);
      const result = runGate({ cwd, baseline: written.baseline });
      expect(result.code).toBe(0);
      expect(result.printed).toBe("");
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
      const written = runGate({ cwd, args: ["--write"] });
      expect(written.code).toBe(1);
      expect(written.printed).toMatch(/missing-export errors/u);
      const listed = `${JSON.stringify(
        {
          version: 1,
          workspaces: {
            ".": [
              {
                file: "missing.ts",
                code: "TS2305",
                message: "Module '\"./empty.ts\"' has no exported member 'absent'.",
                count: 1,
              },
            ],
          },
        },
        null,
        2,
      )}\n`;
      const result = runGate({ cwd, baseline: listed });
      expect(result.code).toBe(1);
      expect(result.printed).toMatch(/missing-export errors/u);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("treats diagnostics that differ only by checkout path as the same diagnostic", () => {
    expect.hasAssertions();
    const checkout = path.join(repositoryRoot, ".local", "effect-typecheck-checkout");
    const sibling = `${checkout}-other`;
    const output = `src/monitor-fixture.ts(48,7): error TS4023: Exported variable 'ProbeMonitor' has or is using name 'Alert' from external module "${checkout}/libs/monitor/src/index" but cannot be named.\n`;
    const baseline = `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`;
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
    expect(printed).toBe("");
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

  it("does not fail the gate when a snapshotted diagnostic disappears", () => {
    expect.hasAssertions();
    const cwd = createFixture({ "value.ts": "export const value = 1;\n" });
    try {
      const baseline = `${JSON.stringify(
        {
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
        },
        null,
        2,
      )}\n`;
      const result = runGate({ cwd, baseline });
      expect(result.code).toBe(0);
      expect(result.printed).not.toMatch(/typecheck gate:/u);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("matches a diagnostic listed under another workspace after resolving paths", () => {
    expect.hasAssertions();
    const root = "/repo";
    const listed = `${JSON.stringify(
      {
        version: 1,
        workspaces: {
          "libs/auth": [
            {
              file: "src/session.ts",
              code: "TS18046",
              message: "'instance.options' is of type 'unknown'.",
              count: 1,
            },
          ],
        },
      },
      null,
      2,
    )}\n`;
    let printed = "";
    expect(
      runEffectTypecheck({
        cwd: path.join(root, "apps/service-member"),
        repositoryRoot: root,
        args: [],
        baselinePath: "baseline.json",
        compile: () => ({
          output:
            "../../libs/auth/src/session.ts(18,18): error TS18046: 'instance.options' is of type 'unknown'.\n",
          status: 1,
        }),
        readText: () => listed,
        writeText: () => undefined,
        print: (text) => {
          printed += text;
        },
      }),
    ).toBe(0);
    expect(printed).not.toMatch(/typecheck gate:/u);
  });

  it("treats drizzle diagnostics that differ only by pnpm package folders as the same diagnostic", () => {
    expect.hasAssertions();
    const listed = `${JSON.stringify(
      {
        version: 1,
        workspaces: {
          "apps/service-member": [
            {
              file: "src/shared/members/members.ts",
              code: "TS2345",
              message:
                "Argument of type 'import(\"<repo>/node_modules/.pnpm/drizzle-orm@1.0.0-rc.5-ab785fc_left/node_modules/drizzle-orm/sql/sql\").SQL<unknown>' is not assignable to parameter of type 'import(\"<repo>/node_modules/.pnpm/drizzle-orm@1.0.0-rc.5-ab785fc_right/node_modules/drizzle-orm/sql/sql\").SQL<unknown>'.",
              count: 1,
            },
          ],
        },
      },
      null,
      2,
    )}\n`;
    let printed = "";
    expect(
      runEffectTypecheck({
        cwd: "/repo/apps/service-member",
        repositoryRoot: "/repo",
        args: [],
        baselinePath: "baseline.json",
        compile: () => ({
          output:
            "src/shared/members/members.ts(102,14): error TS2345: Argument of type 'import(\"/repo/node_modules/.pnpm/drizzle-orm@1.0.0-rc.4_left/node_modules/drizzle-orm/sql/sql\").SQL<unknown>' is not assignable to parameter of type 'import(\"/repo/node_modules/.pnpm/drizzle-orm@1.0.0-rc.4_right/node_modules/drizzle-orm/sql/sql\").SQL<unknown>'.\n",
          status: 1,
        }),
        readText: () => listed,
        writeText: () => undefined,
        print: (text) => {
          printed += text;
        },
      }),
    ).toBe(0);
    expect(printed).not.toMatch(/typecheck gate:/u);
  });

  it("fails when the same snapshotted diagnostic appears an extra time", () => {
    expect.hasAssertions();
    const cwd = createFixture({
      "value.ts": 'export const first: number = "a";\nexport const second: number = "b";\n',
    });
    try {
      const doubled = runGate({ cwd });
      expect(doubled.printed).toMatch(/\u00d72/u);
      const baseline = `${JSON.stringify(
        {
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
        },
        null,
        2,
      )}\n`;
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
    const rootWrite = runGate({
      cwd: repositoryRoot,
      repositoryRoot,
      args: ["--write"],
      compile: () => ({ output: "", status: 0 }),
    });
    expect(Object.keys(JSON.parse(rootWrite.baseline).workspaces)).toStrictEqual([]);
    const packageWrite = runGate({
      cwd: path.join(repositoryRoot, "libs/vite-config"),
      repositoryRoot,
      args: ["--write"],
      compile: () => ({
        output:
          "src/value.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'.\n",
        status: 1,
      }),
    });
    expect(Object.keys(JSON.parse(packageWrite.baseline).workspaces)).toStrictEqual([
      "libs/vite-config",
    ]);
    let outside: unknown;
    try {
      runGate({
        cwd: path.join(repositoryRoot, ".."),
        repositoryRoot,
        compile: () => ({ output: "", status: 0 }),
      });
    } catch (error) {
      outside = error;
    }
    expect(outside).toBeInstanceOf(Error);
    expect(String(outside)).toMatch(/is outside/u);
    const committed = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "libs/vite-config/src/effect-typecheck-baseline.json"),
        "utf8",
      ),
    ) as {
      readonly workspaces: Readonly<Record<string, readonly { readonly code: string }[]>>;
    };
    expect(
      Object.values(committed.workspaces)
        .flat()
        .filter((entry) => (missingExportCodes as readonly string[]).includes(entry.code)),
    ).toStrictEqual([]);
    const loose = runGate({
      cwd: repositoryRoot,
      repositoryRoot,
      compile: () => ({
        output: "error TS2688: Cannot find type definition file for 'node'.\n",
        status: 1,
      }),
    });
    expect(loose.code).toBe(1);
    expect(loose.printed).toMatch(/error TS2688: Cannot find type definition file for 'node'/u);
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

  it("exits the process with the gate status when invoked as the CLI", () => {
    expect.hasAssertions();
    mkdirSync(path.join(repositoryRoot, ".local"), { recursive: true });
    const cwd = mkdtempSync(path.join(repositoryRoot, ".local", "effect-typecheck-cli-"));
    writeFileSync(path.join(cwd, "tsconfig.json"), fixtureTsconfig);
    writeFileSync(path.join(cwd, "value.ts"), 'export const value: number = "new";\n');
    const modulePath = fileURLToPath(new URL("./effect-typecheck.ts", import.meta.url));
    try {
      const invoked = spawnSync(process.execPath, [modulePath], {
        cwd,
        encoding: "utf8",
        env: pathWithBins(),
      });
      expect(invoked.status).toBe(1);
      expect(`${invoked.stdout ?? ""}${invoked.stderr ?? ""}`).toMatch(/typecheck gate:/u);
      const imported = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", `import ${JSON.stringify(modulePath)};`],
        { encoding: "utf8", env: pathWithBins() },
      );
      expect(imported.status).toBe(0);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("flushes stdout before exiting so the gate report is not truncated", () => {
    expect.hasAssertions();
    mkdirSync(path.join(repositoryRoot, ".local"), { recursive: true });
    const cwd = mkdtempSync(path.join(repositoryRoot, ".local", "effect-typecheck-flush-"));
    writeFileSync(path.join(cwd, "tsconfig.json"), fixtureTsconfig);
    writeFileSync(path.join(cwd, "value.ts"), 'export const value: number = "new";\n');
    const modulePath = fileURLToPath(new URL("./effect-typecheck.ts", import.meta.url));
    try {
      const result = spawnSync(process.execPath, [modulePath], {
        cwd,
        encoding: "utf8",
        env: pathWithBins(),
      });
      expect(result.status).toBe(1);
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      expect(output).toMatch(/error TS2322/u);
      expect(output).toMatch(/typecheck gate: 1 new diagnostics/u);
      expect(output.endsWith("\n")).toBe(true);
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
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
