import { Effect, Schema } from "effect";

import { affectedTests, shardDirectories, type WorkspacePackage } from "./pr-affected-scope.ts";
import { prCheckRootShard, prCheckShardCount } from "./test-runtime.ts";

class NotAWorkspaceFilter extends Schema.TaggedError<NotAWorkspaceFilter>()("NotAWorkspaceFilter", {
  directory: Schema.String,
}) {
  public override get message(): string {
    return `${this.directory} is not a workspace filter`;
  }
}

const shardOutput = (
  checkShard: string,
  {
    files,
    packages,
    rootTestFiles,
  }: Readonly<{
    files: readonly string[];
    packages: readonly WorkspacePackage[];
    rootTestFiles: readonly string[];
  }>,
): Effect.Effect<string, NotAWorkspaceFilter> =>
  Effect.gen(function* shardOutput() {
    if (checkShard === prCheckRootShard) {
      return ["root=true", "filters=", "paths=", ""].join("\n");
    }
    const affected = affectedTests(files, packages);
    const directories = shardDirectories(
      affected.kind === "all"
        ? packages.map((workspace) => workspace.directory)
        : affected.directories,
      Number(checkShard),
      prCheckShardCount,
    );
    const names = yield* Effect.forEach(directories, (directory) => {
      const workspace = packages.find((item) => item.directory === directory);
      if (
        workspace === undefined ||
        !/^(?:apps|libs|infra|tools)\/[\w-]+$/u.test(directory) ||
        !/^@repo\/[\w-]+$/u.test(workspace.name)
      ) {
        return Effect.fail(NotAWorkspaceFilter.make({ directory }));
      }
      return Effect.succeed(workspace.name);
    });
    return [
      "root=false",
      `filters=${names.map((name) => `--filter ${name}`).join(" ")}`,
      `paths=${
        affected.kind === "all"
          ? ""
          : directories
              .filter((directory) => rootTestFiles.some((file) => file.startsWith(`${directory}/`)))
              .join(" ")
      }`,
      "",
    ].join("\n");
  });

export { shardOutput };
export type { NotAWorkspaceFilter };
