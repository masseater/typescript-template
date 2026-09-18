import { privateDeploymentKeys } from "@template/config/deployment-keys";

const secretWords = [
  "secret",
  "token",
  "password",
  "passphrase",
  "cookie",
  "authorization",
  String.raw`api[_-]?key`,
  ...privateDeploymentKeys,
];
const secretName = String.raw`[\w.-]*(?:${secretWords.join("|")})[\w.-]*`;
const quotedValue = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`;
const bareValue = String.raw`[^,)}\]\n]*`;
const secretAssignment = new RegExp(
  String.raw`("?)(${secretName})\1([ \t]*[:=][ \t]*)(${quotedValue}|${bareValue})`,
  "giu",
);
const secretKey = new RegExp(`^${secretName}$`, "iu");
const quotePattern = /^["']/u;
const placeholder = "[redacted]";

function maskAssignment(_match: string, ...captures: readonly string[]): string {
  const [nameQuote = "", name = "", separator = "", value = ""] = captures;
  const valueQuote = quotePattern.exec(value)?.[0] ?? nameQuote;
  return `${nameQuote}${name}${nameQuote}${separator}${valueQuote}${placeholder}${valueQuote}`;
}

function redactSecrets(value: string): string {
  return value.replaceAll(secretAssignment, maskAssignment);
}

function isSecretKey(key: string): boolean {
  return secretKey.test(key);
}

export { isSecretKey, placeholder as redactedValue, redactSecrets };
