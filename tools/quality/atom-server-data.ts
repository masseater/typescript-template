import type { LintContext, Node, NodeOf } from "./lint-context.ts";
import { origins, variableOf } from "./references.ts";
import type { Origin } from "./references.ts";

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

function normalized(origin: Origin): Origin {
  const [source = "", ...members] = origin;
  return source.startsWith(`${reactivity}/`)
    ? [reactivity, source.slice(reactivity.length + 1), ...members]
    : origin;
}

function isServerCacheApi(origin: Origin): boolean {
  const [source = "", first = "", second = ""] = normalized(origin);
  return (
    serverCacheApis[source]?.has(first) === true ||
    serverCacheApis[`${source}.${first}`]?.has(second) === true
  );
}

function isAtomConstructor(context: LintContext, callee: Node): boolean {
  return origins(context, callee).some((origin) => {
    const [source = "", namespace = "", member = ""] = normalized(origin);
    return (
      (source === reactivity && namespace === "Atom" && atomConstructors.has(member)) ||
      (/^(?:@template\/ui|\.{1,2}\/(?:[^/]+\/)*request)$/u.test(source) &&
        namespace === "requestAtom")
    );
  });
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function children(node: Node): Node[] {
  return Object.entries(node).flatMap(([key, value]: readonly [string, unknown]) => {
    if (key === "parent") {
      return [];
    }
    const values: readonly unknown[] = Array.isArray(value) ? value : [value];
    return values.filter((child) => isNode(child));
  });
}

function isIoOrigin(origin: Origin): boolean {
  const [source = "", member = ""] = origin;
  return ioModules.test(source) || (source === "global" && ioGlobals.has(member));
}

function localDefinitions(context: LintContext, node: Node): Node[] {
  if (node.type !== "Identifier") {
    return [];
  }
  return (variableOf(context, node)?.defs ?? []).flatMap(({ node: definition }) => {
    if (definition.type === "FunctionDeclaration") {
      return [definition];
    }
    return definition.type === "VariableDeclarator" && definition.init ? [definition.init] : [];
  });
}

function performsIo(context: LintContext, node: Node, seen: Set<Node>): boolean {
  if (seen.has(node)) {
    return false;
  }
  seen.add(node);
  if (node.type === "Identifier" || node.type === "MemberExpression") {
    const unresolvedGlobal =
      node.type === "Identifier" &&
      ioGlobals.has(node.name) &&
      variableOf(context, node) === undefined;
    if (unresolvedGlobal || origins(context, node).some((origin) => isIoOrigin(origin))) {
      return true;
    }
  }
  return [...children(node), ...localDefinitions(context, node)].some((child) =>
    performsIo(context, child, seen),
  );
}

function holdsServerData(context: LintContext, node: NodeOf<"CallExpression">): boolean {
  return (
    isAtomConstructor(context, node.callee) &&
    node.arguments.some((argument) => performsIo(context, argument, new Set()))
  );
}

export { holdsServerData, isServerCacheApi };
