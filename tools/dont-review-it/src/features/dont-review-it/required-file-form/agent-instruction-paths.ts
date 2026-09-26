import { Effect, type FileSystem, type PlatformError } from "effect";
import { remark } from "remark";

import { pathExists, textOrNull } from "../platform/file-system.ts";
import { path, posixPath } from "../platform/path.ts";

import type { InlineCode, Nodes } from "mdast";
import type { RepositoryProblem } from "../problem.ts";
import type { RequiredFileFormConfig } from "./config.ts";

const FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".css",
  ".json",
  ".md",
  ".mdx",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const NOT_FILE_PATH_PREFIXES = ["/", "@", "./"] as const;

const inlineCodesIn = (node: Nodes): readonly InlineCode[] => {
  if (node.type === "inlineCode") return [node];
  if (!("children" in node)) return [];
  const children: readonly Nodes[] = node.children;
  return children.flatMap(inlineCodesIn);
};

const isFilePathShaped = (text: string): boolean => {
  if (/\s/u.test(text) || text.includes("://")) return false;
  if (NOT_FILE_PATH_PREFIXES.some((prefix) => text.startsWith(prefix))) return false;
  return text.includes(posixPath.sep) || FILE_EXTENSIONS.has(posixPath.extname(text));
};

export const agentInstructionPathsIn = ({
  repositoryRoot,
  packageRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly packageRoot: string;
  readonly config: RequiredFileFormConfig;
}): Effect.Effect<
  readonly RepositoryProblem[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* agentInstructionPathsIn() {
    const instructionFile = posixPath.normalize(
      `${packageRoot}/${config.agentInstructionFileName}`,
    );
    const instructions = yield* textOrNull(path.join(repositoryRoot, instructionFile));
    if (instructions === null) return [];

    const references = inlineCodesIn(remark().parse(instructions)).filter((code) =>
      isFilePathShaped(code.value),
    );
    const resolvable = yield* Effect.forEach(
      references,
      (code) =>
        Effect.map(
          Effect.all([
            pathExists(path.join(repositoryRoot, packageRoot, code.value)),
            pathExists(path.join(repositoryRoot, code.value)),
          ]),
          ([fromPackage, fromRoot]) => fromPackage || fromRoot,
        ),
      { concurrency: "unbounded" },
    );
    const unresolved = references.flatMap((code, index) =>
      resolvable[index] === true ? [] : [code],
    );

    return unresolved.map((code): RepositoryProblem => ({
      file: instructionFile,
      line: code.position?.start.line ?? null,
      message: `Agent instructions must not name a path that does not exist. \`${code.value}\` resolves neither from ${packageRoot} nor from the repository root. Point it at the current location, or drop the reference.`,
    }));
  });
