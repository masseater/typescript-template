import { objectExpressionOf } from "./default-exported-object.ts";
import {
  collectBinding,
  isReferenceTo,
  newBinding,
  type ImportedTarget,
} from "./imported-binding.ts";
import { propertyKeyOf } from "./object-literal.ts";
import { staticMemberOf } from "./static-member.ts";

import type { ESTree, Visitor } from "@oxlint/plugins";

type EnvironmentKeyPlace = "schema" | "config" | "read";

type EnvironmentKeyOccurrence = {
  readonly place: EnvironmentKeyPlace;
  readonly name: string | null;
  readonly node: ESTree.Node;
  readonly declaration: ESTree.Expression | null;
};

type OccurrenceListener = (occurrence: EnvironmentKeyOccurrence) => void;

type EnvironmentKeyVisitor = Visitor & { readonly Program: (node: ESTree.Program) => void };

const WORKER_MODULE = "cloudflare:workers";

const WORKER_ENV_EXPORT = "env";

const WORKER_HANDLER_METHODS: ReadonlySet<string> = new Set([
  "email",
  "fetch",
  "queue",
  "scheduled",
  "tail",
  "trace",
]);

const SCHEMA_NAMESPACE = "Schema";

const SCHEMA_STRUCT = "Struct";

const CONFIG_NAMESPACE = "Config";

const CONFIG_KEY_AT_SECOND_ARGUMENT: ReadonlySet<string> = new Set(["Array", "array", "schema"]);

const CONFIG_READERS: ReadonlySet<string> = new Set([
  ...CONFIG_KEY_AT_SECOND_ARGUMENT,
  "Boolean",
  "boolean",
  "Date",
  "date",
  "Duration",
  "duration",
  "Int",
  "int",
  "Integer",
  "integer",
  "Literal",
  "literal",
  "LogLevel",
  "logLevel",
  "NonEmptyString",
  "nonEmptyString",
  "Number",
  "number",
  "Port",
  "port",
  "Redacted",
  "redacted",
  "String",
  "string",
  "Url",
  "url",
]);

const SCREAMING_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;

const isScreamingSnake = (name: string): boolean => SCREAMING_SNAKE.test(name);

const screamingSnakeOf = (spelled: string): string =>
  isScreamingSnake(spelled)
    ? spelled
    : spelled.replaceAll(/(?<=[a-z0-9])(?=[A-Z])/gu, "_").toUpperCase();

type ConstantStrings = ReadonlyMap<string, string>;

const stripTypeWrappers = (expression: ESTree.Expression): ESTree.Expression => {
  if (expression.type === "TSAsExpression" || expression.type === "TSSatisfiesExpression") {
    return stripTypeWrappers(expression.expression);
  }
  return expression;
};

const stringOf = (expression: ESTree.Expression): string | null => {
  const written = stripTypeWrappers(expression);
  if (written.type === "Literal") return typeof written.value === "string" ? written.value : null;
  if (written.type !== "TemplateLiteral" || written.expressions.length > 0) return null;
  return written.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join("");
};

const constantStringsOf = (program: ESTree.Program): ConstantStrings =>
  new Map(
    program.body.flatMap((statement) => {
      const declaration =
        statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
      if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") return [];
      return declaration.declarations.flatMap((declarator) => {
        if (declarator.id.type !== "Identifier" || declarator.init === null) return [];
        const holder = declarator.id.name;
        const initial = stripTypeWrappers(declarator.init);
        const own = stringOf(initial);
        if (own !== null) return [[holder, own] as const];
        if (initial.type !== "ObjectExpression") return [];
        return initial.properties.flatMap((property) => {
          if (property.type !== "Property") return [];
          const key = propertyKeyOf(property);
          const held = stringOf(property.value);
          return key === null || held === null ? [] : [[`${holder}.${key}`, held] as const];
        });
      });
    }),
  );

const keyNameOf = (expression: ESTree.Expression, constants: ConstantStrings): string | null => {
  const written = stripTypeWrappers(expression);
  const literal = stringOf(written);
  if (literal !== null) return literal;
  if (written.type === "Identifier") return constants.get(written.name) ?? null;
  const member = staticMemberOf(written);
  if (member === null || member.object.type !== "Identifier") return null;
  return constants.get(`${member.object.name}.${member.name}`) ?? screamingSnakeOf(member.name);
};

const isNamespaceCall = (
  node: ESTree.CallExpression,
  namespace: string,
): { readonly member: string } | null => {
  const member = staticMemberOf(node.callee);
  if (member === null || member.object.type !== "Identifier") return null;
  return member.object.name === namespace ? { member: member.name } : null;
};

const isProcessReference = (expression: ESTree.Expression): boolean => {
  if (expression.type === "Identifier") return expression.name === "process";
  const member = staticMemberOf(expression);
  return (
    member !== null &&
    member.name === "process" &&
    member.object.type === "Identifier" &&
    member.object.name === "globalThis"
  );
};

const isProcessEnvironment = (expression: ESTree.Expression): boolean => {
  const member = staticMemberOf(expression);
  if (member === null || member.name !== "env") return false;
  if (member.object.type === "MetaProperty") return true;
  return isProcessReference(member.object);
};

type SourceTracking = {
  readonly workerEnv: ImportedTarget;
  readonly workerClasses: Set<string>;
  readonly aliases: Set<string>;
  readonly handlerParameters: { name: string; start: number; end: number }[];
};

const isThisEnvInWorkerClass = (
  expression: ESTree.Expression,
  tracking: SourceTracking,
): boolean => {
  const member = staticMemberOf(expression);
  if (member === null || member.name !== "env" || member.object.type !== "ThisExpression") {
    return false;
  }
  const enclosingClass = ancestorsOf(expression).find(
    (ancestor): ancestor is ESTree.Class =>
      ancestor.type === "ClassDeclaration" || ancestor.type === "ClassExpression",
  );
  const heritage = enclosingClass?.superClass;
  return heritage?.type === "Identifier" && tracking.workerClasses.has(heritage.name);
};

const ancestorsOf = (node: ESTree.Node): ESTree.Node[] => {
  const { parent } = node as { readonly parent?: ESTree.Node | null };
  return parent === undefined || parent === null ? [] : [parent, ...ancestorsOf(parent)];
};

const isHandlerParameter = (expression: ESTree.Expression, tracking: SourceTracking): boolean =>
  expression.type === "Identifier" &&
  tracking.handlerParameters.some(
    ({ name, start, end }) =>
      name === expression.name && expression.start >= start && expression.end <= end,
  );

const isEnvironmentSource = (expression: ESTree.Expression, tracking: SourceTracking): boolean => {
  const written = stripTypeWrappers(expression);
  return (
    isProcessEnvironment(written) ||
    isReferenceTo(written, tracking.workerEnv) ||
    (written.type === "Identifier" && tracking.aliases.has(written.name)) ||
    isThisEnvInWorkerClass(written, tracking) ||
    isHandlerParameter(written, tracking)
  );
};

const handlerParametersOf = (
  node: ESTree.ExportDefaultDeclaration,
): SourceTracking["handlerParameters"] => {
  const exported = objectExpressionOf(node.declaration);
  if (exported === null) return [];
  return exported.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    const key = propertyKeyOf(property);
    if (key === null || !WORKER_HANDLER_METHODS.has(key)) return [];
    const handler = property.value;
    if (handler.type !== "FunctionExpression" && handler.type !== "ArrowFunctionExpression") {
      return [];
    }
    const environment = handler.params[1];
    if (environment?.type !== "Identifier") return [];
    return [{ name: environment.name, start: handler.start, end: handler.end }];
  });
};

const schemaKeyOccurrences = (
  node: ESTree.CallExpression,
  constants: ConstantStrings,
): EnvironmentKeyOccurrence[] => {
  if (isNamespaceCall(node, SCHEMA_NAMESPACE)?.member !== SCHEMA_STRUCT) return [];
  const [fields] = node.arguments;
  if (fields?.type !== "ObjectExpression") return [];
  return fields.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    const name = property.computed
      ? keyNameOf(property.key as ESTree.Expression, constants)
      : propertyKeyOf(property);
    if (name === null || !isScreamingSnake(name)) return [];
    return [{ place: "schema", name, node: property.key, declaration: property.value }];
  });
};

const configKeyOccurrences = (
  node: ESTree.CallExpression,
  constants: ConstantStrings,
): EnvironmentKeyOccurrence[] => {
  const called = isNamespaceCall(node, CONFIG_NAMESPACE);
  if (called === null || !CONFIG_READERS.has(called.member)) return [];
  const keyAt = CONFIG_KEY_AT_SECOND_ARGUMENT.has(called.member) ? 1 : 0;
  const argument = node.arguments[keyAt];
  if (argument === undefined || argument.type === "SpreadElement") return [];
  const name = keyNameOf(argument, constants);
  if (name === null || !isScreamingSnake(name)) return [];
  return [{ place: "config", name, node: argument, declaration: node }];
};

const isWrittenRatherThanRead = (node: ESTree.MemberExpression): boolean => {
  const { parent } = node;
  if (parent.type === "AssignmentExpression") return parent.left === node;
  return parent.type === "UnaryExpression" && parent.operator === "delete";
};

const readKeyOf = (
  node: ESTree.MemberExpression,
  constants: ConstantStrings,
): EnvironmentKeyOccurrence => {
  if (!node.computed && node.property.type === "Identifier") {
    return { place: "read", name: node.property.name, node, declaration: null };
  }
  return {
    place: "read",
    name: keyNameOf(node.property as ESTree.Expression, constants),
    node,
    declaration: null,
  };
};

const destructuredReads = (
  pattern: ESTree.ObjectPattern,
  constants: ConstantStrings,
): EnvironmentKeyOccurrence[] =>
  pattern.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    const name = property.computed
      ? keyNameOf(property.key as ESTree.Expression, constants)
      : property.key.type === "Identifier"
        ? property.key.name
        : stringOf(property.key as ESTree.Expression);
    return [{ place: "read", name, node: property, declaration: null }];
  });

export const environmentKeyVisitor = (onOccurrence: OccurrenceListener): EnvironmentKeyVisitor => {
  const tracking: SourceTracking = {
    workerEnv: { exportedName: WORKER_ENV_EXPORT, binding: newBinding() },
    workerClasses: new Set<string>(),
    aliases: new Set<string>(),
    handlerParameters: [],
  };
  const constants: { current: ConstantStrings } = { current: new Map() };

  return {
    Program(node: ESTree.Program) {
      constants.current = constantStringsOf(node);
    },
    ImportDeclaration(node: ESTree.ImportDeclaration) {
      if (node.source.value !== WORKER_MODULE) return;
      collectBinding(node, tracking.workerEnv);
      for (const specifier of node.specifiers) {
        tracking.workerClasses.add(specifier.local.name);
      }
    },
    ExportDefaultDeclaration(node: ESTree.ExportDefaultDeclaration) {
      tracking.handlerParameters.push(...handlerParametersOf(node));
    },
    VariableDeclarator(node: ESTree.VariableDeclarator) {
      if (node.init === null || !isEnvironmentSource(node.init, tracking)) return;
      if (node.id.type === "Identifier") {
        tracking.aliases.add(node.id.name);
        return;
      }
      if (node.id.type !== "ObjectPattern") return;
      for (const occurrence of destructuredReads(node.id, constants.current)) {
        onOccurrence(occurrence);
      }
    },
    MemberExpression(node: ESTree.MemberExpression) {
      if (!isEnvironmentSource(node.object, tracking) || isWrittenRatherThanRead(node)) return;
      onOccurrence(readKeyOf(node, constants.current));
    },
    CallExpression(node: ESTree.CallExpression) {
      for (const occurrence of [
        ...schemaKeyOccurrences(node, constants.current),
        ...configKeyOccurrences(node, constants.current),
      ]) {
        onOccurrence(occurrence);
      }
    },
  };
};
