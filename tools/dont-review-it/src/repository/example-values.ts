import { filename, reportViolation, type LintContext, type Node } from "./lint-context.ts";
import { propertyName, staticText } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const fixtureFile = /(?:\.test\.tsx?|-fixture\.ts)$/u;
const webProtocols: ReadonlySet<string> = new Set(["http:", "https:"]);

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

const isExampleHost = (hostname: string): boolean => {
  const hostLabels = hostname.split(".");
  return (
    hostLabels.length === 1 ||
    loopbackHost.test(hostname) ||
    externalServiceHosts.has(hostname) ||
    hostLabels.some((hostLabel) => reservedLabels.has(hostLabel))
  );
};

const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const syntheticUuid = /^[0-9-]+$/u;

const isExampleValue = (written: string): boolean => {
  if (uuidShape.test(written)) {
    return syntheticUuid.test(written);
  }
  const url = URL.parse(written);
  return url === null || !webProtocols.has(url.protocol) || isExampleHost(url.hostname);
};

const valueChecker = (inspection: LintContext): ((node: Node) => void) => {
  return (node) => {
    const written = staticText(inspection, node);
    if (written !== undefined && !isExampleValue(written)) {
      reportViolation(inspection, node);
    }
  };
};

const secretName = /secret|token|password|credential/iu;
const exampleSecret = /^[^A-Z]*$/u;

const secretChecker = (
  inspection: LintContext,
): ((declared: string | undefined, node: Node) => void) => {
  return (declared, node) => {
    const written =
      declared !== undefined && secretName.test(declared)
        ? staticText(inspection, node)
        : undefined;
    if (written !== undefined && !exampleSecret.test(written)) {
      reportViolation(inspection, node);
    }
  };
};

const exampleValuesVisitor = (inspection: LintContext): Visitor => {
  if (!fixtureFile.test(filename(inspection))) {
    return {};
  }
  const checkValue = valueChecker(inspection);
  const checkSecret = secretChecker(inspection);
  return {
    Literal(node: Node): void {
      checkValue(node);
    },
    Property(node: Node): void {
      if (node.type === "Property") {
        checkSecret(propertyName(inspection, node), node.value);
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
};

export { exampleLabels, exampleValuesVisitor };
