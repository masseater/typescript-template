import { privateDeploymentKeys } from "@repo/config/deployment-keys";

const listWords = ["cookie", "params"];
const secretWords = [
  "secret",
  "token",
  "password",
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

function maskedValue(text: string, start: number, label: string): Masked {
  const nameQuote = quotePattern.exec(label)?.[0] ?? "";
  const listed = nameQuote === "" && listLabel.test(label);
  const end = valueEnd(text, start, listed ? listEnders : valueEnders);
  const quote = quotePattern.exec(text.slice(start, end))?.[0] ?? nameQuote;
  return { end, value: `${quote}${placeholder}${quote}` };
}

function redactSecrets(text: string): string {
  let redacted = "";
  let cursor = 0;
  secretLabel.lastIndex = 0;
  for (let match = secretLabel.exec(text); match !== null; match = secretLabel.exec(text)) {
    const masked = maskedValue(text, match.index + match[0].length, match[0]);
    redacted += `${text.slice(cursor, match.index)}${match[0]}${masked.value}`;
    cursor = masked.end;
    secretLabel.lastIndex = cursor;
  }
  return redacted + text.slice(cursor);
}

function isSecretKey(key: string): boolean {
  return secretKey.test(key);
}

export { isSecretKey, placeholder as redactedValue, redactSecrets };
