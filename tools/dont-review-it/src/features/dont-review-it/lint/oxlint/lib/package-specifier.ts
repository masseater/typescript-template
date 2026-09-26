import { segmentsOf } from "./path-segments.ts";

const SCOPE_PREFIX = "@";

export const packageReferenceOf = (
  specifier: string,
): { readonly name: string; readonly subpath: string } | null => {
  const segments = segmentsOf({ path: specifier, separator: "/" });
  const takenSegments = specifier.startsWith(SCOPE_PREFIX) ? 2 : 1;
  if (segments.length < takenSegments) return null;

  const trailing = segments.slice(takenSegments);
  return {
    name: segments.slice(0, takenSegments).join("/"),
    subpath: trailing.length === 0 ? "." : `./${trailing.join("/")}`,
  };
};

export const packageNameOf = (specifier: string): string | undefined =>
  packageReferenceOf(specifier)?.name;
