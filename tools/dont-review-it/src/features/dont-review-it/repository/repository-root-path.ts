import { filename, reportViolation, type LintContext, type Node } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";

const repositoryRootOwner = "libs/config/src/features/config/repository-root.ts";

const deepParentPath = /(?:^|\/)(?:\.\.\/){3}\.\.(?:\/|$)/u;

const moduleLocations: ReadonlySet<string> = new Set(["dirname", "filename", "url"]);

const writtenText = (node: Node): string | undefined => {
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }
  return node.type === "TemplateLiteral"
    ? node.quasis.map((quasi) => quasi.value.cooked ?? "").join("")
    : undefined;
};

const isModuleLocation = (node: Node): boolean =>
  node.type === "MemberExpression" &&
  node.object.type === "MetaProperty" &&
  node.object.meta.name === "import" &&
  node.object.property.name === "meta" &&
  node.property.type === "Identifier" &&
  moduleLocations.has(node.property.name);

const isNode = (candidate: unknown): candidate is Node =>
  typeof candidate === "object" &&
  candidate !== null &&
  "type" in candidate &&
  typeof candidate.type === "string";

const childrenOf = (node: Node): readonly Node[] =>
  Object.entries(node)
    .filter(([key]) => key !== "parent")
    .flatMap(([, child]: readonly [string, unknown]) =>
      Array.isArray(child) ? child.filter(isNode) : isNode(child) ? [child] : [],
    );

const readsModuleLocation = (node: Node): boolean =>
  isModuleLocation(node) || childrenOf(node).some(readsModuleLocation);

const checkCall = (
  inspection: LintContext,
  call: { readonly arguments: readonly Node[]; readonly node: Node },
): void => {
  const joinedPath = call.arguments
    .flatMap((argument) => writtenText(argument) ?? [])
    .join("/")
    .replaceAll(/\/+/gu, "/");
  if (deepParentPath.test(joinedPath) && call.arguments.some(readsModuleLocation)) {
    reportViolation(inspection, call.node);
  }
};

const repositoryRootPathVisitor = (inspection: LintContext): Visitor => {
  if (filename(inspection).endsWith(`/${repositoryRootOwner}`)) {
    return {};
  }
  return {
    CallExpression(node: Node): void {
      if (node.type === "CallExpression") {
        checkCall(inspection, { arguments: node.arguments, node });
      }
    },
    NewExpression(node: Node): void {
      if (node.type === "NewExpression") {
        checkCall(inspection, { arguments: node.arguments, node });
      }
    },
  };
};

export { repositoryRootOwner, repositoryRootPathVisitor };
