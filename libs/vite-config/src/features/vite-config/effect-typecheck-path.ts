import { Effect, Schema } from "effect";

import { filesystem, paths } from "./host.ts";

class OutsideRepository extends Schema.TaggedError<OutsideRepository>()("OutsideRepository", {
  directory: Schema.String,
  repositoryRoot: Schema.String,
}) {
  override get message(): string {
    return `${this.directory} is outside ${this.repositoryRoot}`;
  }
}

const checkoutRoots = Effect.fn("checkoutRoots")(function* checkoutRoots(
  repositoryRootPath: string,
) {
  const resolvedRoot = paths.resolve(repositoryRootPath);
  if (!(yield* filesystem.exists(resolvedRoot))) {
    return [resolvedRoot];
  }
  const realRoot = yield* filesystem.realPath(resolvedRoot);
  return realRoot === resolvedRoot ? [resolvedRoot] : [realRoot, resolvedRoot];
});

const checkoutMarker = "<repo>";

const replaceCheckoutRoot = (sourceText: string, root: string): string => {
  const found = sourceText.indexOf(root);
  if (found === -1) {
    return sourceText;
  }
  const after = found + root.length;
  const boundaryCharacter = sourceText[after];
  const replacement =
    boundaryCharacter === undefined || boundaryCharacter === "/" ? checkoutMarker : root;
  return (
    sourceText.slice(0, found) + replacement + replaceCheckoutRoot(sourceText.slice(after), root)
  );
};

const withoutCheckoutPath = (sourceText: string, roots: readonly string[]): string =>
  roots
    .toSorted((left, right) => right.length - left.length)
    .reduce((remainingText, root) => replaceCheckoutRoot(remainingText, root), sourceText);

const workspaceOf = (
  cwd: string,
  repositoryRootPath: string,
): Effect.Effect<string, OutsideRepository> => {
  const resolvedCwd = paths.resolve(cwd);
  const resolvedRoot = paths.resolve(repositoryRootPath);
  const relativePath = paths.relative(resolvedRoot, resolvedCwd);
  if (relativePath.startsWith("..") || paths.isAbsolute(relativePath)) {
    return Effect.fail(
      new OutsideRepository({ directory: resolvedCwd, repositoryRoot: resolvedRoot }),
    );
  }
  return Effect.succeed(relativePath === "" ? "." : relativePath.split(paths.sep).join("/"));
};

export { checkoutRoots, OutsideRepository, withoutCheckoutPath, workspaceOf };
