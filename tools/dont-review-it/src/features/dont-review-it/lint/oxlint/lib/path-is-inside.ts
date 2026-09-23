import { path } from "../../../platform/path.ts";

export const pathIsInside = (parent: string, candidate: string): boolean => {
  const pathFromParent = path.relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." &&
      !pathFromParent.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(pathFromParent))
  );
};
