import { segmentsOf } from "../path-segments.ts";

export const specDirectoryOf = ({
  relativePath,
  names,
}: {
  readonly relativePath: string;
  readonly names: ReadonlySet<string>;
}): string | null => {
  const directorySegments = segmentsOf({ path: relativePath, separator: "/" }).slice(0, -1);
  const outermost = directorySegments.findIndex((segment) => names.has(segment));
  return outermost === -1 ? null : directorySegments.slice(0, outermost + 1).join("/");
};
