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
const secretLabel = new RegExp(String.raw`("?)(?:${secretName})\1(?:${separator})`, "giu");
const secretKey = new RegExp(`^${secretName}$`, "iu");
const listLabel = new RegExp(`(?:${listWords.join("|")})(?:${separator})$`, "iu");
const quotePattern = /^["']/u;
const quotes = new Set(['"', "'"]);
const openers = new Set(["[", "{"]);
const enclosers = new Set(["]", "}"]);
const valueEnders = new Set([",", ")", "}", "]", "\n"]);
const listEnders = new Set(['"', "'", "\\", "\n"]);
const escapedWidth = 2;
const placeholder = "[redacted]";
const positionKeys: ReadonlySet<string> = new Set(["error.locations"]);
const digitsOnly = /^\d+(?::\d+)*$/u;

interface Masked {
  readonly end: number;
  readonly value: string;
}

function quotedEnd(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === "\n") {
      return index;
    }
    if (character === quote) {
      return index + 1;
    }
    index += character === "\\" ? escapedWidth : 1;
  }
  return text.length;
}

function bracketDepth(character: string): number {
  if (openers.has(character)) {
    return 1;
  }
  return enclosers.has(character) ? -1 : 0;
}

function bracketedEnd(text: string, start: number): number {
  let depth = 0;
  let index = start;
  while (index < text.length && text[index] !== "\n" && (depth > 0 || index === start)) {
    const character = text[index] ?? "";
    depth += bracketDepth(character);
    index = quotes.has(character) ? quotedEnd(text, index) : index + 1;
  }
  return index;
}

function bareEnd(text: string, start: number, enders: ReadonlySet<string>): number {
  let index = start;
  while (index < text.length && !enders.has(text[index] ?? "")) {
    index += 1;
  }
  return index;
}

function valueEnd(text: string, start: number, enders: ReadonlySet<string>): number {
  const first = text[start] ?? "";
  if (quotes.has(first)) {
    return quotedEnd(text, start);
  }
  return openers.has(first) ? bracketedEnd(text, start) : bareEnd(text, start, enders);
}

function maskedValue(
  text: string,
  found: Readonly<{ keepNumbers: boolean; label: string; start: number }>,
): Masked {
  const { keepNumbers, label, start } = found;
  const nameQuote = quotePattern.exec(label)?.[0] ?? "";
  const listed = nameQuote === "" && listLabel.test(label);
  const end = valueEnd(text, start, listed ? listEnders : valueEnders);
  const value = text.slice(start, end);
  if (keepNumbers && digitsOnly.test(value)) {
    return { end, value };
  }
  const quote = quotePattern.exec(value)?.[0] ?? nameQuote;
  return { end, value: `${quote}${placeholder}${quote}` };
}

function redactSecrets(text: string, keepNumbers = false): string {
  let redacted = "";
  let cursor = 0;
  secretLabel.lastIndex = 0;
  for (let match = secretLabel.exec(text); match !== null; match = secretLabel.exec(text)) {
    const masked = maskedValue(text, {
      keepNumbers,
      label: match[0],
      start: match.index + match[0].length,
    });
    redacted += `${text.slice(cursor, match.index)}${match[0]}${masked.value}`;
    cursor = masked.end;
    secretLabel.lastIndex = cursor;
  }
  return redacted + text.slice(cursor);
}

function isSecretKey(key: string): boolean {
  return secretKey.test(key);
}

function redactedField(key: string, value: unknown): unknown {
  if (isSecretKey(key)) {
    return placeholder;
  }
  if (value instanceof Error) {
    return { message: value.message, name: value.name };
  }
  return typeof value === "string" ? redactSecrets(value, positionKeys.has(key)) : value;
}

export { redactSecrets, redactedField };
