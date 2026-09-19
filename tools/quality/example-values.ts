import {
  filename,
  fixtureOrTestFile,
  reportViolation,
  type LintContext,
  type Node,
} from "./lint-context.ts";
import { propertyKey, propertyName, staticText } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const exampleHostGuidance =
  ".example / .test / .invalid / .localhost / example.com|net|org / *.example.ts.net";

const externalServiceHosts: ReadonlySet<string> = new Set([
  "api.cloudflare.com",
  "opentelemetry.io",
  "registry.npmjs.org",
  "registry.npmjs.com",
]);

const loopbackHost = /^(?:localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|\[[0:]+1\])$/u;

const reservedSuffixes: readonly string[] = [
  ".example",
  ".test",
  ".invalid",
  ".localhost",
  ".example.com",
  ".example.net",
  ".example.org",
  ".example.ts.net",
];

const reservedExactHosts: ReadonlySet<string> = new Set([
  "example",
  "test",
  "invalid",
  "localhost",
  "example.com",
  "example.net",
  "example.org",
  "example.ts.net",
]);

const checkableHostTld =
  /^(?:com|net|org|io|dev|app|cloud|local|localhost|test|example|invalid)$/iu;

const hostShape = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/iu;

const documentationIpv4 = /^(?:192\.0\.2|198\.51\.100|203\.0\.113)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)$/u;

const documentationIpv6 = /^\[?2001:db8:[0-9a-f:]*\]?$/iu;

const isDocumentationAddress = (hostname: string): boolean => {
  return documentationIpv4.test(hostname) || documentationIpv6.test(hostname);
};

const isExampleHost = (hostname: string): boolean => {
  const normalized = hostname.replace(/\.$/u, "").toLowerCase();
  if (
    reservedExactHosts.has(normalized) ||
    loopbackHost.test(normalized) ||
    externalServiceHosts.has(normalized) ||
    isDocumentationAddress(normalized)
  ) {
    return true;
  }
  return reservedSuffixes.some((suffix) => normalized.endsWith(suffix));
};

const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const syntheticUuid = /^[0-9-]+$/u;
const hexIdentifier = /^(?:[0-9a-f]{16}|[0-9a-f]{32})$/iu;
const syntheticHex = /^(?:(.)\1*|[0-9]+)$/u;
const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const knownToken =
  /^(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255}|(?:AKIA|ASIA)[A-Z0-9]{16})$/u;
const base64Secret =
  /^(?=[A-Za-z0-9+/]*[A-Z])(?=[A-Za-z0-9+/]*[a-z])(?=[A-Za-z0-9+/]*\d)[A-Za-z0-9+/]{40,}={0,2}$/u;

const parsedUrl = (written: string): URL | null => {
  if (written.startsWith("//")) {
    return URL.parse(`https:${written}`);
  }
  return URL.parse(written);
};

const looksLikeHostname = (written: string): boolean => {
  if (!hostShape.test(written) || written.includes("/") || written.includes(":")) {
    return false;
  }
  const tld = written.slice(written.lastIndexOf(".") + 1);
  return checkableHostTld.test(tld);
};

const isExampleValue = (written: string): boolean => {
  if (emailShape.test(written)) {
    return isExampleHost(written.slice(written.lastIndexOf("@") + 1));
  }
  if (uuidShape.test(written)) {
    return syntheticUuid.test(written);
  }
  if (hexIdentifier.test(written)) {
    return syntheticHex.test(written);
  }
  if (knownToken.test(written) || base64Secret.test(written)) {
    return false;
  }
  const url = parsedUrl(written);
  if (url !== null && url.hostname !== "") {
    return isExampleHost(url.hostname);
  }
  return !looksLikeHostname(written) || isExampleHost(written);
};

const valueChecker = (inspection: LintContext): ((node: Node) => void) => {
  return (node) => {
    const written = staticText(inspection, node);
    if (written !== undefined && !isExampleValue(written)) {
      reportViolation(inspection, node);
    }
  };
};

const secretName =
  /secret|token|password|credential|authorization|apikey|bearer|passphrase|signature/iu;
const exampleSecret = /^(?:Bearer\s+)?[^A-Z]*$/u;

const secretChecker = (
  inspection: LintContext,
): ((declared: string | undefined, node: Node | null | undefined) => void) => {
  return (declared, node) => {
    if (node === null || node === undefined) {
      return;
    }
    const written =
      declared !== undefined && secretName.test(declared)
        ? staticText(inspection, node)
        : undefined;
    if (written !== undefined && !exampleSecret.test(written)) {
      reportViolation(inspection, node);
    }
  };
};

const memberPropertyName = (inspection: LintContext, node: Node): string | undefined => {
  if (node.type !== "MemberExpression") {
    return undefined;
  }
  return propertyKey(inspection, node);
};

const exampleValuesVisitor = (inspection: LintContext): Visitor => {
  if (!fixtureOrTestFile.test(filename(inspection))) {
    return {};
  }
  const checkValue = valueChecker(inspection);
  const checkSecret = secretChecker(inspection);
  return {
    ArrayExpression(node: Node): void {
      if (node.type !== "ArrayExpression") {
        return;
      }
      for (const element of node.elements) {
        if (element !== null && element.type !== "SpreadElement") {
          checkValue(element);
        }
      }
    },
    AssignmentExpression(node: Node): void {
      if (node.type === "AssignmentExpression") {
        checkSecret(memberPropertyName(inspection, node.left), node.right);
      }
    },
    Literal(node: Node): void {
      checkValue(node);
    },
    Property(node: Node): void {
      if (node.type === "Property") {
        checkSecret(propertyName(inspection, node), node.value);
      }
    },
    PropertyDefinition(node: Node): void {
      if (node.type !== "PropertyDefinition" || node.value === null) {
        return;
      }
      const declared =
        !node.computed && node.key.type === "Identifier"
          ? node.key.name
          : staticText(inspection, node.key);
      checkSecret(declared, node.value);
    },
    TemplateLiteral(node: Node): void {
      checkValue(node);
    },
    VariableDeclarator(node: Node): void {
      if (node.type === "VariableDeclarator" && node.init && node.id.type === "Identifier") {
        checkSecret(node.id.name, node.init);
      }
    },
  };
};

export { exampleHostGuidance, exampleValuesVisitor };
