import { AUTHENTICATION_METHOD } from "@repo/config";
import { privateDeploymentKeys } from "@repo/config/deployment-keys";

const listWords = ["cookie", "params"];
const secretWords = [
  "secret",
  "token",
  AUTHENTICATION_METHOD.password,
  "passphrase",
  "authorization",
  String.raw`api[_-]?key`,
  ...listWords,
  ...privateDeploymentKeys,
];
const secretName = String.raw`[\w.-]*(?:${secretWords.join("|")})[\w.-]*`;
const separator = String.raw`[ \t]*[:=][ \t]*`;
const secretLabel = new RegExp(String.raw`("?)(?:${secretName})\1(?:${separator})`, "iu");
const secretKey = new RegExp(`^${secretName}$`, "iu");
const listLabel = new RegExp(`(?:${listWords.join("|")})(?:${separator})$`, "iu");
const quotePattern = /^["']/u;
const valueEnders = new Set([",", ")", "}", "]", "\n"]);
const listEnders = new Set(['"', "'", "\\", "\n"]);
const placeholder = "[redacted]";

const indicesFrom = (source: string, start: number): readonly number[] =>
  [...source.split("").keys()].slice(start);

const quotedRuns: Readonly<Record<string, RegExp>> = {
  '"': /^"(?:\\[\s\S]|[^\\\n"])*(?:"|$|(?=\n))/u,
  "'": /^'(?:\\[\s\S]|[^\\\n'])*(?:'|$|(?=\n))/u,
};

const quotedEnd = (source: string, start: number): number => {
  const quoted = quotedRuns[source[start] ?? ""]?.exec(source.slice(start)) ?? null;
  return quoted === null ? source.length : start + quoted[0].length;
};

const openers = new Set(["[", "{"]);
const enclosers = new Set(["]", "}"]);

const bracketDepth = (character: string): number => {
  if (openers.has(character)) {
    return 1;
  }
  return enclosers.has(character) ? -1 : 0;
};

const quotes = new Set(['"', "'"]);

const bracketedEnd = (source: string, start: number): number =>
  indicesFrom(source, start).reduce<{
    readonly cursor: number;
    readonly depth: number;
    readonly stopped: boolean;
  }>(
    (scan, index) => {
      if (scan.stopped || index !== scan.cursor) {
        return scan;
      }
      const character = source[index] ?? "";
      if (character === "\n") {
        return { ...scan, stopped: true };
      }
      const depth = scan.depth + bracketDepth(character);
      return {
        cursor: quotes.has(character) ? quotedEnd(source, index) : index + 1,
        depth,
        stopped: depth <= 0,
      };
    },
    { cursor: start, depth: 0, stopped: false },
  ).cursor;

type ScannedValue = {
  readonly source: string;
  readonly start: number;
  readonly enders: ReadonlySet<string>;
};

const bareEnd = (scanned: ScannedValue): number =>
  indicesFrom(scanned.source, scanned.start).find((index) =>
    scanned.enders.has(scanned.source[index] ?? ""),
  ) ?? scanned.source.length;

const valueEnd = (scanned: ScannedValue): number => {
  const first = scanned.source[scanned.start] ?? "";
  if (quotes.has(first)) {
    return quotedEnd(scanned.source, scanned.start);
  }
  return openers.has(first) ? bracketedEnd(scanned.source, scanned.start) : bareEnd(scanned);
};

const maskedValue = (masked: {
  readonly source: string;
  readonly start: number;
  readonly secretLabelText: string;
}): { readonly end: number; readonly value: string } => {
  const nameQuote = quotePattern.exec(masked.secretLabelText)?.[0] ?? "";
  const listed = nameQuote === "" && listLabel.test(masked.secretLabelText);
  const end = valueEnd({
    enders: listed ? listEnders : valueEnders,
    source: masked.source,
    start: masked.start,
  });
  const quote = quotePattern.exec(masked.source.slice(masked.start, end))?.[0] ?? nameQuote;
  return { end, value: `${quote}${placeholder}${quote}` };
};

const redactSecrets = (source: string): string => {
  const scanned = indicesFrom(source, 0).reduce<{
    readonly cursor: number;
    readonly finished: boolean;
    readonly redacted: string;
  }>(
    (scan) => {
      if (scan.finished) {
        return scan;
      }
      const found = secretLabel.exec(source.slice(scan.cursor));
      if (found === null) {
        return { ...scan, finished: true };
      }
      const labelStart = scan.cursor + found.index;
      const masked = maskedValue({
        secretLabelText: found[0],
        source,
        start: labelStart + found[0].length,
      });
      return {
        cursor: masked.end,
        finished: false,
        redacted: `${scan.redacted}${source.slice(scan.cursor, labelStart)}${found[0]}${masked.value}`,
      };
    },
    { cursor: 0, finished: false, redacted: "" },
  );
  return scanned.redacted + source.slice(scanned.cursor);
};

const isSecretKey = (fieldName: string): boolean => secretKey.test(fieldName);

const redactedField = (fieldName: string, fieldValue: unknown): unknown => {
  if (isSecretKey(fieldName)) {
    return placeholder;
  }
  if (fieldValue instanceof Error) {
    return { message: fieldValue.message, name: fieldValue.name };
  }
  return typeof fieldValue === "string" ? redactSecrets(fieldValue) : fieldValue;
};

export { redactSecrets, redactedField };
