// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { existsSync, realpathSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

const checkoutRoots = (repositoryRootPath: string): readonly string[] => {
  const resolvedRoot = path.resolve(repositoryRootPath);
  if (!existsSync(resolvedRoot)) {
    return [resolvedRoot];
  }
  const realRoot = realpathSync(resolvedRoot);
  return realRoot === resolvedRoot ? [resolvedRoot] : [realRoot, resolvedRoot];
};

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

const withoutCheckoutPath = (sourceText: string, repositoryRootPath: string): string =>
  checkoutRoots(repositoryRootPath)
    .toSorted((left, right) => right.length - left.length)
    .reduce((remainingText, root) => replaceCheckoutRoot(remainingText, root), sourceText);

const workspaceOf = (cwd: string, repositoryRootPath: string): string => {
  const resolvedCwd = path.resolve(cwd);
  const resolvedRoot = path.resolve(repositoryRootPath);
  const relativePath = path.relative(resolvedRoot, resolvedCwd);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${resolvedCwd} is outside ${resolvedRoot}`);
  }
  return relativePath === "" ? "." : relativePath.split(path.sep).join("/");
};

export { withoutCheckoutPath, workspaceOf };
