import { AUTHENTICATION_METHOD } from "@repo/config/identity";

import { privateDeploymentKeys } from "./deployment-keys.ts";

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
const positionKeys: ReadonlySet<string> = new Set(["error.locations"]);
const digitsOnly = /^\d+(?::\d+)*$/u;

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

class TextScan {
  cursor: number;
  depth = 0;
  stopped = false;
  redacted = "";
  finished = false;
  readonly source: string;

  constructor(source: string, start: number) {
    this.source = source;
    this.cursor = start;
  }

  bracketedEnd(): number {
    this.depth = 0;
    this.stopped = false;
    while (!this.stopped && this.cursor < this.source.length) {
      const index = this.cursor;
      const character = this.source[index] ?? "";
      if (character === "\n") {
        this.stopped = true;
        break;
      }
      this.depth += bracketDepth(character);
      this.cursor = quotes.has(character) ? quotedEnd(this.source, index) : index + 1;
      if (this.depth <= 0) {
        this.stopped = true;
      }
    }
    return this.cursor;
  }

  bareEnd(enders: ReadonlySet<string>): number {
    while (this.cursor < this.source.length && !enders.has(this.source[this.cursor] ?? "")) {
      this.cursor += 1;
    }
    return this.cursor < this.source.length ? this.cursor : this.source.length;
  }

  redact(keepNumbers = false): string {
    this.cursor = 0;
    this.redacted = "";
    this.finished = false;
    while (!this.finished) {
      const found = secretLabel.exec(this.source.slice(this.cursor));
      if (found === null) {
        this.finished = true;
        break;
      }
      const labelStart = this.cursor + found.index;
      const masked = maskedValue({
        keepNumbers,
        secretLabelText: found[0],
        source: this.source,
        start: labelStart + found[0].length,
      });
      this.redacted = `${this.redacted}${this.source.slice(this.cursor, labelStart)}${found[0]}${masked.value}`;
      this.cursor = masked.end;
    }
    return this.redacted + this.source.slice(this.cursor);
  }
}

type ScannedValue = {
  readonly source: string;
  readonly start: number;
  readonly enders: ReadonlySet<string>;
};

const valueEnd = (scanned: ScannedValue): number => {
  const first = scanned.source[scanned.start] ?? "";
  if (quotes.has(first)) {
    return quotedEnd(scanned.source, scanned.start);
  }
  const scan = new TextScan(scanned.source, scanned.start);
  return openers.has(first) ? scan.bracketedEnd() : scan.bareEnd(scanned.enders);
};

const maskedValue = (masked: {
  readonly keepNumbers: boolean;
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
  const value = masked.source.slice(masked.start, end);
  if (masked.keepNumbers && digitsOnly.test(value)) {
    return { end, value };
  }
  const quote = quotePattern.exec(value)?.[0] ?? nameQuote;
  return { end, value: `${quote}${placeholder}${quote}` };
};

const redactSecrets = (source: string, keepNumbers = false): string =>
  new TextScan(source, 0).redact(keepNumbers);

const isSecretKey = (fieldName: string): boolean => secretKey.test(fieldName);

const redactedField = (fieldName: string, fieldValue: unknown): unknown => {
  if (isSecretKey(fieldName)) {
    return placeholder;
  }
  if (typeof (fieldValue as { _tag?: unknown })._tag === "string") {
    const tagged = fieldValue as {
      readonly _tag: string;
      readonly cause?: unknown;
      readonly code?: unknown;
      readonly keys?: unknown;
      readonly reason?: unknown;
    };
    return {
      _tag: tagged._tag,
      ...Object.fromEntries(Object.entries(fieldValue as object)),
      ...(tagged.cause === undefined ? {} : { cause: tagged.cause }),
      ...(tagged.reason === undefined ? {} : { reason: tagged.reason }),
      ...(tagged.code === undefined ? {} : { code: tagged.code }),
      ...(tagged.keys === undefined ? {} : { keys: tagged.keys }),
    };
  }
  if (fieldValue instanceof Error) {
    return { message: fieldValue.message, name: fieldValue.name };
  }
  return typeof fieldValue === "string"
    ? redactSecrets(fieldValue, positionKeys.has(fieldName))
    : fieldValue;
};

const appliedField = (
  value: unknown,
  field: (name: string, current: unknown) => unknown,
  name = "",
): unknown => {
  const replaced = field(name, value);
  if (Array.isArray(replaced)) {
    return replaced.map((item, index) => appliedField(item, field, String(index)));
  }
  if (replaced !== null && typeof replaced === "object") {
    return Object.fromEntries(
      Object.entries(replaced).map(([key, item]) => [key, appliedField(item, field, key)]),
    );
  }
  return replaced;
};

export { appliedField, redactSecrets, redactedField };
