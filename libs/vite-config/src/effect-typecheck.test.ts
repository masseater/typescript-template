import { readFileSync } from "node:fs";
import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, test } from "vite-plus/test";

import { parseBaseline, serializeBaseline } from "./effect-typecheck-baseline.ts";
import { compileWorkspace } from "./effect-typecheck-compiler.ts";
import { parseTscOutput } from "./effect-typecheck-diagnostics.ts";
import { workspaceOf } from "./effect-typecheck-path.ts";
import { runTypecheckGate } from "./effect-typecheck.ts";

const assignabilityDiagnostic =
  "value.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\n";
const assignabilityMessage = "Type 'string' is not assignable to type 'number'.";
const assignabilityBaseline = serializeBaseline({
  version: 1,
  workspaces: {
    ".": [{ file: "value.ts", code: "TS2322", message: assignabilityMessage, count: 1 }],
  },
});
const missingExportCodes = ["TS2305", "TS2459", "TS2460", "TS2614", "TS2724"] as const;

describe("effect typecheck gate", () => {
  const it = test
    .extend("newDiagnostic", () =>
      runTypecheckGate({ compilerTranscript: assignabilityDiagnostic, status: 1 }))
    .extend("snapshottedDiagnostic", () =>
      runTypecheckGate({
        baselineText: assignabilityBaseline,
        compilerTranscript: assignabilityDiagnostic,
        status: 1,
      }),
    )
    .extend("repositoryWorkspace", () => workspaceOf(repositoryRoot, repositoryRoot))
    .extend("packageWorkspace", () =>
      workspaceOf(path.join(repositoryRoot, "libs/vite-config"), repositoryRoot),
    )
    .extend("outsideWorkspaceMessage", () => {
      try {
        workspaceOf(path.join(repositoryRoot, ".."), repositoryRoot);
        throw new Error("workspaceOf accepted a directory outside the repository");
      } catch (workspaceFailure: unknown) {
        return workspaceFailure instanceof Error ? workspaceFailure.message : "unknown failure";
      }
    })
    .extend("canonicalBaseline", () =>
      serializeBaseline(
        parseBaseline(
          readFileSync(
            path.join(repositoryRoot, "libs/vite-config/src/effect-typecheck-baseline.json"),
            "utf-8",
          ),
        ),
      ),
    )
    .extend("committedBaseline", () =>
      readFileSync(
        path.join(repositoryRoot, "libs/vite-config/src/effect-typecheck-baseline.json"),
        "utf-8",
      ),
    )
    .extend("looseDiagnostic", () =>
      parseTscOutput("error TS2688: Cannot find type definition file for 'node'.\n"),
    )
    .extend("prettyDiagnostic", () =>
      parseTscOutput(
        "src/value.ts:1:7 - error TS2322: Type 'string' is not assignable to type 'number'.\n",
      ),
    )
    .extend("locatedCompiler", () =>
      compileWorkspace({
        cwd: path.join(repositoryRoot, "libs/vite-config"),
        locate: () => {
          throw new Error("typecheck gate: compiler not found");
        },
      }),
    )
    .extend("unknownFlag", () =>
      runTypecheckGate({ gateArguments: ["--rewrite"], compilerTranscript: "", status: 0 }),
    )
    .extend("silentCompiler", () =>
      runTypecheckGate({ compilerTranscript: "effect-tsgo: not found", status: 1 }),
    )
    .extend("portableDiagnostic", () => {
      const checkout = "/checkout";
      const compilerTranscript = `src/monitor-fixture.ts(48,7): error TS4023: Exported variable 'ProbeMonitor' has or is using name 'Alert' from external module "${checkout}/libs/monitor/src/index" but cannot be named.\n`;
      return runTypecheckGate({
        cwd: checkout,
        repositoryRootPath: checkout,
        compilerTranscript,
        baselineText: serializeBaseline({
          version: 1,
          workspaces: {
            ".": [
              {
                file: "src/monitor-fixture.ts",
                code: "TS4023",
                message:
                  "Exported variable 'ProbeMonitor' has or is using name 'Alert' from external module \"<repo>/libs/monitor/src/index\" but cannot be named.",
                count: 1,
              },
            ],
          },
        }),
      });
    })
    .extend("disappearedDiagnostic", () =>
      runTypecheckGate({ compilerTranscript: "", status: 0, baselineText: assignabilityBaseline }),
    )
    .extend("snapshottedExportCodes", () =>
      Object.values(
        parseBaseline(
          readFileSync(
            path.join(repositoryRoot, "libs/vite-config/src/effect-typecheck-baseline.json"),
            "utf-8",
          ),
        ).workspaces,
      )
        .flat()
        .map((diagnostic) => diagnostic.code)
        .filter((code) => missingExportCodes.some((missingCode) => missingCode === code)),
    )
    .extend("missingExportDiagnostic", () => {
      const compilerTranscript =
        "src/index.ts(1,10): error TS2305: Module '\"./missing\"' has no exported member 'Gone'.\n";
      return runTypecheckGate({
        compilerTranscript,
        baselineText: serializeBaseline({
          version: 1,
          workspaces: {
            ".": [
              {
                file: "src/index.ts",
                code: "TS2305",
                message: "Module '\"./missing\"' has no exported member 'Gone'.",
                count: 1,
              },
            ],
          },
        }),
      });
    });

  it("fails a new assignability error that is not on the snapshot", ({ newDiagnostic }) => {
    expect(newDiagnostic).toStrictEqual({
      exitStatus: 1,
      transcript: `${assignabilityDiagnostic}typecheck gate: 1 new diagnostics\nvalue.ts: error TS2322: ${assignabilityMessage}\n`,
    });
  });

  it("keeps a snapshotted assignability error from failing the gate", ({
    snapshottedDiagnostic,
  }) => {
    expect(snapshottedDiagnostic).toStrictEqual({
      exitStatus: 0,
      transcript: assignabilityDiagnostic,
    });
  });

  it("names the repository root as the workspace", ({ repositoryWorkspace }) => {
    expect(repositoryWorkspace).toBe(".");
  });

  it("names a package directory from the repository root", ({ packageWorkspace }) => {
    expect(packageWorkspace).toBe("libs/vite-config");
  });

  it("rejects a directory outside the repository", ({ outsideWorkspaceMessage }) => {
    expect(outsideWorkspaceMessage).toBe(
      `${path.resolve(repositoryRoot, "..")} is outside ${path.resolve(repositoryRoot)}`,
    );
  });

  it("keeps the committed snapshot canonical", ({ canonicalBaseline, committedBaseline }) => {
    expect(canonicalBaseline).toBe(committedBaseline);
  });

  it("reads a diagnostic that has no file location", ({ looseDiagnostic }) => {
    expect(looseDiagnostic).toStrictEqual([
      { file: "", code: "TS2688", message: "Cannot find type definition file for 'node'." },
    ]);
  });

  it("reads a pretty diagnostic line", ({ prettyDiagnostic }) => {
    expect(prettyDiagnostic).toStrictEqual([
      {
        file: "src/value.ts",
        code: "TS2322",
        message: assignabilityMessage,
      },
    ]);
  });

  it("compiles through an injected locator", ({ locatedCompiler }) => {
    expect(locatedCompiler).toStrictEqual({
      output: "typecheck gate: compiler not found\n",
      status: 1,
    });
  });

  it("rejects an unknown flag", ({ unknownFlag }) => {
    expect(unknownFlag).toStrictEqual({
      exitStatus: 1,
      transcript: "Unknown option --rewrite.\n",
    });
  });

  it("fails when the compiler exits without diagnostics", ({ silentCompiler }) => {
    expect(silentCompiler).toStrictEqual({
      exitStatus: 1,
      transcript: "effect-tsgo: not found\ntypecheck gate: compiler exited without diagnostics\n",
    });
  });

  it("treats diagnostics that differ only by checkout path as the same diagnostic", ({
    portableDiagnostic,
  }) => {
    expect(portableDiagnostic).toStrictEqual({
      exitStatus: 0,
      transcript: `src/monitor-fixture.ts(48,7): error TS4023: Exported variable 'ProbeMonitor' has or is using name 'Alert' from external module "/checkout/libs/monitor/src/index" but cannot be named.\n`,
    });
  });

  it("fails when a snapshotted diagnostic disappears", ({ disappearedDiagnostic }) => {
    expect(disappearedDiagnostic).toStrictEqual({
      exitStatus: 1,
      transcript: `\ntypecheck gate: 1 baselined diagnostics are gone; rewrite the snapshot\nvalue.ts: error TS2322: ${assignabilityMessage}\n`,
    });
  });

  it("does not baseline missing-export diagnostics", ({ snapshottedExportCodes }) => {
    expect(snapshottedExportCodes).toStrictEqual([]);
  });

  it("still fails a missing export that was written into the snapshot", ({
    missingExportDiagnostic,
  }) => {
    expect(missingExportDiagnostic).toStrictEqual({
      exitStatus: 1,
      transcript:
        "src/index.ts(1,10): error TS2305: Module '\"./missing\"' has no exported member 'Gone'.\ntypecheck gate: 1 missing-export errors\nsrc/index.ts: error TS2305: Module '\"./missing\"' has no exported member 'Gone'.\ntypecheck gate: 1 baselined diagnostics are gone; rewrite the snapshot\nsrc/index.ts: error TS2305: Module '\"./missing\"' has no exported member 'Gone'.\n",
    });
  });
});
