import { isScalar, LineCounter, parseDocument } from "yaml";

const LIBRARY_VERSION_PATH = ["metadata", "library_version"] as const;

const FRONTMATTER_PATTERN = /^---\n(?<frontmatter>.*?)\n---/su;

const FRONTMATTER_OFFSET = "---\n".length;

type DeclaredVersion = Readonly<{
  end: number;
  line: number;
  start: number;
  value: unknown;
}>;

const declaredVersionOf = (source: string): DeclaredVersion | null => {
  const frontmatterText = FRONTMATTER_PATTERN.exec(source)?.groups?.frontmatter;
  if (frontmatterText === undefined) return null;

  const lineCounter = new LineCounter();
  const frontmatter = parseDocument(frontmatterText, { lineCounter });
  if (frontmatter.errors.length > 0) return null;

  const declared = frontmatter.getIn(LIBRARY_VERSION_PATH, true);
  if (!isScalar(declared) || declared.range === null || declared.range === undefined) return null;

  const [start, end] = declared.range;
  return {
    end: FRONTMATTER_OFFSET + end,
    line: lineCounter.linePos(start).line + 1,
    start: FRONTMATTER_OFFSET + start,
    value: declared.value,
  };
};

export const libraryVersionOf = (source: string): string | null => {
  const declared = declaredVersionOf(source)?.value;
  return typeof declared === "string" ? declared : null;
};

export const lineOfLibraryVersion = (source: string): number | null =>
  declaredVersionOf(source)?.line ?? null;

export const withLibraryVersion = ({
  source,
  version,
}: {
  readonly source: string;
  readonly version: string;
}): string => {
  const declared = declaredVersionOf(source);
  return declared === null
    ? source
    : `${source.slice(0, declared.start)}${JSON.stringify(version)}${source.slice(declared.end)}`;
};
