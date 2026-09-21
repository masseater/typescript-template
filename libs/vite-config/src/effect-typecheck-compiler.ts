// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { fileURLToPath } from "node:url";

const binRelative = (
  manifest: Readonly<{ readonly bin?: Readonly<Record<string, string>> }>,
): string => {
  const relativeBin = manifest.bin?.["effect-tsgo"];
  if (relativeBin === undefined) {
    throw new Error("typecheck gate: @effect/tsgo is missing the effect-tsgo bin");
  }
  return relativeBin;
};

const effectTsgoBin = (): string => {
  const packageJsonPath = fileURLToPath(import.meta.resolve("@effect/tsgo/package.json"));
  return path.join(
    path.dirname(packageJsonPath),
    binRelative(
      JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
        readonly bin?: Readonly<Record<string, string>>;
      },
    ),
  );
};

type CompilerResult = {
  readonly output: string;
  readonly status: number;
};

type SpawnTranscript = {
  readonly status: number | null;
  readonly stderr: string | null;
  readonly stdout: string | null;
};

const combinedOutput = (spawned: SpawnTranscript): CompilerResult => ({
  output: `${spawned.stdout ?? ""}${spawned.stderr ?? ""}`,
  status: spawned.status ?? 1,
});

const compilerFromResolution = (spawned: SpawnTranscript): string => {
  const executable = (spawned.stdout ?? "").trim();
  if (spawned.status !== 0 || executable === "") {
    throw new Error(combinedOutput(spawned).output || "typecheck gate: compiler not found");
  }
  return executable;
};

const locateCompiler = (environment?: Readonly<Record<string, string | undefined>>): string =>
  compilerFromResolution(
    spawnSync(process.execPath, [effectTsgoBin(), "get-exe-path"], {
      encoding: "utf-8",
      ...(environment === undefined ? {} : { env: { ...environment } }),
    }),
  );

const compilerFailureTranscript = (compilerFailure: unknown): string =>
  compilerFailure instanceof Error
    ? `${compilerFailure.message}\n`
    : "typecheck gate: compiler not found\n";

const compileWorkspace = (
  asked: Readonly<{
    cwd: string;
    environment?: Readonly<Record<string, string | undefined>>;
    locate?: (environment?: Readonly<Record<string, string | undefined>>) => string;
  }>,
): CompilerResult => {
  const locate = asked.locate ?? locateCompiler;
  try {
    const executable = locate(asked.environment);
    return combinedOutput(
      spawnSync(executable, ["--pretty", "false", "--noEmit", "-p", "tsconfig.json"], {
        cwd: asked.cwd,
        encoding: "utf-8",
        ...(asked.environment === undefined ? {} : { env: { ...asked.environment } }),
      }),
    );
  } catch (compilerFailure: unknown) {
    return { output: compilerFailureTranscript(compilerFailure), status: 1 };
  }
};

export { compileWorkspace };
export type { CompilerResult };
