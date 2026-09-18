import {
  fixtureOrTestFile,
  reportViolation,
  type LintContext,
  type Node,
  type NodeOf,
} from "./lint-context.ts";
import { propertyName, staticText } from "./references.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const gitExecutable = /(?:^|\/)git(?:\.exe)?$/u;

const startsGit = (inspection: LintContext, node: NodeOf<"CallExpression">): boolean => {
  const [command] = node.arguments;
  if (command === undefined || command.type === "SpreadElement") {
    return false;
  }
  const executable = staticText(inspection, command);
  return executable !== undefined && gitExecutable.test(executable);
};

const declaresEnvironment = (inspection: LintContext, node: Node): boolean => {
  return (
    node.type === "ObjectExpression" &&
    node.properties.some(
      (property) => property.type === "Property" && propertyName(inspection, property) === "env",
    )
  );
};

const gitEnvironmentVisitor = (inspection: LintContext): Visitor => {
  if (!fixtureOrTestFile.test(inspection.filename.replaceAll("\\", "/"))) {
    return {};
  }
  return {
    CallExpression(node: Node): void {
      if (node.type !== "CallExpression" || !startsGit(inspection, node)) {
        return;
      }
      if (!node.arguments.some((argument) => declaresEnvironment(inspection, argument))) {
        reportViolation(inspection, node);
      }
    },
  };
};

export { gitEnvironmentVisitor };
