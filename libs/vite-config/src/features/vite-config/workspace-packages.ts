import { Effect, Schema } from "effect";
import { parse } from "yaml";

import { filesystem, paths } from "./host.ts";

const WorkspaceDefinition = Schema.Struct({ packages: Schema.Array(Schema.String) });

const PackageManifest = Schema.fromJsonString(
  Schema.Struct({
    dependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
    devDependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
    name: Schema.String,
    optionalDependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
    peerDependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  }),
);

type WorkspaceMember = Readonly<{
  directory: string;
  packageName: string;
  workspaceDependencies: readonly string[];
}>;

const workspaceDependencies = (manifest: typeof PackageManifest.Type): readonly string[] =>
  [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].flatMap((declared) =>
    Object.entries(declared ?? {}).flatMap(([dependencyName, versionRange]) =>
      versionRange.startsWith("workspace:") ? [dependencyName] : [],
    ),
  );

class UnlistableWorkspace extends Schema.TaggedError<UnlistableWorkspace>()("UnlistableWorkspace", {
  definition: Schema.String,
  reason: Schema.String,
}) {
  override get message(): string {
    return `${this.definition} does not list the workspace packages: ${this.reason}`;
  }
}

const holdsManifest = Effect.fn("holdsManifest")(function* holdsManifest(
  root: string,
  directory: string,
) {
  const directoryStat = yield* filesystem.stat(paths.join(root, directory));
  return (
    directoryStat.type === "Directory" &&
    (yield* filesystem.exists(paths.join(root, directory, "package.json")))
  );
});

const packageDirectoriesMatching = Effect.fn("packageDirectoriesMatching")(
  function* packageDirectoriesMatching(root: string, pattern: string) {
    const parent = pattern.slice(0, -"/*".length);
    if (!pattern.endsWith("/*") || parent === "" || /[*?[\]{}!]/u.test(parent)) {
      return yield* UnlistableWorkspace.make({
        definition: paths.join(root, "pnpm-workspace.yaml"),
        reason: `${pattern} is not a <directory>/* package pattern`,
      });
    }
    const childNames = yield* filesystem.readDirectory(paths.join(root, parent));
    const candidates = childNames.map((childName) => `${parent}/${childName}`);
    const manifests = yield* Effect.forEach(candidates, (directory) =>
      holdsManifest(root, directory),
    );
    return candidates.filter((_directory, index) => manifests[index] === true);
  },
);

const workspaceMemberAt = Effect.fn("workspaceMemberAt")(function* workspaceMemberAt(
  root: string,
  directory: string,
) {
  const manifest = yield* Schema.decodeEffect(PackageManifest)(
    yield* filesystem.readFileString(paths.join(root, directory, "package.json")),
  );
  const member: WorkspaceMember = {
    directory,
    packageName: manifest.name,
    workspaceDependencies: workspaceDependencies(manifest),
  };
  return member;
});

const workspaceMembers = Effect.fn("workspaceMembers")(function* workspaceMembers(root: string) {
  const definition = paths.join(root, "pnpm-workspace.yaml");
  const definitionYaml = yield* filesystem.readFileString(definition);
  const decoded = yield* Effect.try({
    catch: () => UnlistableWorkspace.make({ definition, reason: "it is not YAML" }),
    try: (): unknown => parse(definitionYaml),
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorkspaceDefinition)));
  const directories = yield* Effect.forEach(decoded.packages, (pattern) =>
    packageDirectoriesMatching(root, pattern),
  );
  return yield* Effect.forEach([".", ...directories.flat().toSorted()], (directory) =>
    workspaceMemberAt(root, directory),
  );
});

const unprovidedDependencies = (
  members: readonly WorkspaceMember[],
  byPackageName: ReadonlyMap<string, WorkspaceMember>,
): readonly string[] =>
  members.flatMap((member) =>
    member.workspaceDependencies
      .filter((dependencyName) => !byPackageName.has(dependencyName))
      .map(
        (dependencyName) =>
          `${member.packageName} depends on ${dependencyName}, which no workspace package provides`,
      ),
  );

const reachableFrom = (
  reached: ReadonlySet<string>,
  byPackageName: ReadonlyMap<string, WorkspaceMember>,
): ReadonlySet<string> => {
  const widened = new Set([
    ...reached,
    ...[...reached].flatMap(
      (packageName) => byPackageName.get(packageName)?.workspaceDependencies ?? [],
    ),
  ]);
  return widened.size === reached.size ? reached : reachableFrom(widened, byPackageName);
};

const rangesOf = (
  members: readonly WorkspaceMember[],
  byPackageName: ReadonlyMap<string, WorkspaceMember>,
): ReadonlyMap<string, readonly string[]> =>
  new Map(
    members.map((member) => {
      const reached = reachableFrom(new Set([member.packageName]), byPackageName);
      return [
        member.directory,
        members
          .filter((candidate) => reached.has(candidate.packageName))
          .map((candidate) => candidate.directory),
      ];
    }),
  );

const workspaceDependencyRanges = Effect.fn("workspaceDependencyRanges")(
  function* workspaceDependencyRanges(root: string) {
    const members = yield* workspaceMembers(root);
    const byPackageName = new Map(members.map((member) => [member.packageName, member]));
    const unprovided = unprovidedDependencies(members, byPackageName);
    if (unprovided.length > 0) {
      return yield* UnlistableWorkspace.make({
        definition: paths.join(root, "pnpm-workspace.yaml"),
        reason: unprovided.join("; "),
      });
    }
    return rangesOf(members, byPackageName);
  },
);

export { workspaceDependencyRanges };
