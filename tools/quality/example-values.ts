import type { Visitor } from "vite-plus/lint/plugins";

import type { LintContext, Node } from "./lint-context.ts";
import { filename, reportViolation } from "./lint-context.ts";
import { propertyName, staticText } from "./references.ts";

const fixtureFile = /(?:\.test\.tsx?|-fixture\.ts)$/u;
const exampleLabels: readonly string[] = [
  "example",
  "internal",
  "invalid",
  "local",
  "localhost",
  "test",
];
const reservedLabels: ReadonlySet<string> = new Set(exampleLabels);
const externalServiceHosts: ReadonlySet<string> = new Set(["api.cloudflare.com"]);
const loopbackHost = /^(?:localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|\[[0:]+1\])$/u;
const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const syntheticUuid = /^[0-9-]+$/u;
const secretName = /secret|token|password|credential/iu;
const exampleSecret = /^[^A-Z]*$/u;
const webProtocols: ReadonlySet<string> = new Set(["http:", "https:"]);

function isExampleHost(hostname: string): boolean {
  const labels = hostname.split(".");
  return (
    labels.length === 1 ||
    loopbackHost.test(hostname) ||
    externalServiceHosts.has(hostname) ||
    labels.some((label) => reservedLabels.has(label))
  );
}

function isExampleValue(value: string): boolean {
  if (uuidShape.test(value)) {
    return syntheticUuid.test(value);
  }
  const url = URL.parse(value);
  return url === null || !webProtocols.has(url.protocol) || isExampleHost(url.hostname);
}

function valueChecker(context: LintContext): (node: Node) => void {
  return (node) => {
    const value = staticText(context, node);
    if (value !== undefined && !isExampleValue(value)) {
      reportViolation(context, node);
    }
  };
}

function secretChecker(context: LintContext): (name: string | undefined, node: Node) => void {
  return (name, node) => {
    const value =
      name !== undefined && secretName.test(name) ? staticText(context, node) : undefined;
    if (value !== undefined && !exampleSecret.test(value)) {
      reportViolation(context, node);
    }
  };
}

function exampleValuesVisitor(context: LintContext): Visitor {
  if (!fixtureFile.test(filename(context))) {
    return {};
  }
  const checkValue = valueChecker(context);
  const checkSecret = secretChecker(context);
  return {
    Literal(node: Node): void {
      checkValue(node);
    },
    Property(node: Node): void {
      if (node.type === "Property") {
        checkSecret(propertyName(context, node), node.value);
      }
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
}

export { exampleLabels, exampleValuesVisitor };
