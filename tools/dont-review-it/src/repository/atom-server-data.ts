import type { LintContext, Node, NodeOf } from "./lint-context.ts";
import { origins, variableOf, type Origin } from "./references.ts";

const ioModules = /(?:^|\/)(?:api|client)(?:\/|\.[cm]?[jt]sx?$|$)/u;
const ioGlobals: ReadonlySet<string> = new Set([
  "EventSource",
  "WebSocket",
  "XMLHttpRequest",
  "fetch",
]);
const reactivity = "effect/unstable/reactivity";
const atomConstructors: ReadonlySet<string> = new Set(["make", "readable", "writable"]);
const serverCacheApis: Readonly<Record<string, ReadonlySet<string>>> = {
  "@effect/atom-react": new Set(["useAtomRefresh"]),
  [reactivity]: new Set(["AtomHttpApi", "AtomRpc", "Hydration", "Reactivity"]),
  [`${reactivity}.Atom`]: new Set([
    "makeRefreshOnSignal",
    "refresh",
    "refreshOnWindowFocus",
    "runtime",
    "withReactivity",
  ]),
};

const normalized = (origin: Origin): Origin => {
  const [source = "", ...members] = origin;
  return source.startsWith(`${reactivity}/`)
    ? [reactivity, source.slice(reactivity.length + 1), ...members]
    : origin;
};

const isServerCacheApi = (origin: Origin): boolean => {
  const [source = "", first = "", second = ""] = normalized(origin);
  return (
    serverCacheApis[source]?.has(first) === true ||
    serverCacheApis[`${source}.${first}`]?.has(second) === true
  );
};

const isAtomConstructor = (inspection: LintContext, callee: Node): boolean => {
  return origins(inspection, callee).some((origin) => {
    const [source = "", namespace = "", member = ""] = normalized(origin);
    return (
      (source === reactivity && namespace === "Atom" && atomConstructors.has(member)) ||
      (/^(?:@repo\/(?:auth-ui|ui)|\.{1,2}\/(?:[^/]+\/)*request)$/u.test(source) &&
        namespace === "requestAtom")
    );
  });
};

const isNode = (value: unknown): value is Node => {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
};

const children = (node: Node): Node[] => {
  return Object.entries(node).flatMap(([key, value]: readonly [string, unknown]) => {
    if (key === "parent") {
      return [];
    }
    const values: readonly unknown[] = Array.isArray(value) ? value : [value];
    return values.filter((child) => isNode(child));
  });
};

const isIoOrigin = (origin: Origin): boolean => {
  const [source = "", member = ""] = origin;
  return ioModules.test(source) || (source === "global" && ioGlobals.has(member));
};

const localDefinitions = (inspection: LintContext, node: Node): Node[] => {
  if (node.type !== "Identifier") {
    return [];
  }
  return (variableOf(inspection, node)?.defs ?? []).flatMap(({ node: definition }) => {
    if (definition.type === "FunctionDeclaration") {
      return [definition];
    }
    return definition.type === "VariableDeclarator" && definition.init ? [definition.init] : [];
  });
};

const performsIo = (inspection: LintContext, node: Node, seen: Set<Node>): boolean => {
  if (seen.has(node)) {
    return false;
  }
  seen.add(node);
  if (node.type === "Identifier" || node.type === "MemberExpression") {
    const unresolvedGlobal =
      node.type === "Identifier" &&
      ioGlobals.has(node.name) &&
      variableOf(inspection, node) === undefined;
    if (unresolvedGlobal || origins(inspection, node).some((origin) => isIoOrigin(origin))) {
      return true;
    }
  }
  return [...children(node), ...localDefinitions(inspection, node)].some((child) =>
    performsIo(inspection, child, seen),
  );
};

const holdsServerData = (inspection: LintContext, node: NodeOf<"CallExpression">): boolean => {
  return (
    isAtomConstructor(inspection, node.callee) &&
    node.arguments.some((argument) => performsIo(inspection, argument, new Set()))
  );
};

export { holdsServerData, isServerCacheApi };
