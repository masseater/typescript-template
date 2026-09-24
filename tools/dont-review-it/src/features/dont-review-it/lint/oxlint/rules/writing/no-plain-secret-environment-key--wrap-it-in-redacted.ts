import { createDontReviewItRule } from "../../../../create-rule.ts";
import { environmentKeyVisitor } from "../../lib/environment-keys.ts";
import { staticMemberOf } from "../../lib/static-member.ts";

import type { ESTree } from "@oxlint/plugins";

const SECRET_KEY =
  /(?:^|_)(?:API_KEY|AUTHORIZATION|CREDENTIALS?|PASSWORD|PRIVATE_KEY|SECRET|TOKEN)(?:_|$)/u;

const REDACTED_SCHEMA_PREFIX = "Redacted";

const SCHEMA_WRAPPERS: ReadonlySet<string> = new Set([
  "NullOr",
  "NullishOr",
  "UndefinedOr",
  "optional",
  "optionalKey",
]);

const SCHEMA_REFINEMENTS: ReadonlySet<string> = new Set(["annotate", "check", "pipe"]);

const REDACTED_CONFIG_READERS: ReadonlySet<string> = new Set(["Redacted", "redacted"]);

const CONFIG_MAP = "map";

const REDACTED_MAKE = "make";

type LocalDefinitions = ReadonlyMap<string, ESTree.Expression>;

const namespaceMemberOf = (
  callee: ESTree.Expression,
): { readonly namespace: string; readonly member: string } | null => {
  const member = staticMemberOf(callee);
  if (member === null || member.object.type !== "Identifier") return null;
  return { namespace: member.object.name, member: member.name };
};

const isRedactedSchema = (
  schema: ESTree.Expression,
  definitions: LocalDefinitions,
  visited: ReadonlySet<string>,
): boolean => {
  if (schema.type === "Identifier") {
    const defined = definitions.get(schema.name);
    if (defined === undefined || visited.has(schema.name)) return false;
    return isRedactedSchema(defined, definitions, new Set([...visited, schema.name]));
  }
  if (schema.type !== "CallExpression") return false;
  const called = namespaceMemberOf(schema.callee);
  if (called?.namespace === "Schema" && called.member.startsWith(REDACTED_SCHEMA_PREFIX)) {
    return true;
  }
  const [first] = schema.arguments;
  if (called?.namespace === "Schema" && SCHEMA_WRAPPERS.has(called.member)) {
    return (
      first !== undefined &&
      first.type !== "SpreadElement" &&
      isRedactedSchema(first, definitions, visited)
    );
  }
  const refined = staticMemberOf(schema.callee);
  return (
    refined !== null &&
    SCHEMA_REFINEMENTS.has(refined.name) &&
    isRedactedSchema(refined.object, definitions, visited)
  );
};

const mapsToRedacted = (argument: ESTree.Expression | ESTree.SpreadElement): boolean => {
  if (argument.type !== "CallExpression") return false;
  const called = namespaceMemberOf(argument.callee);
  if (called?.namespace !== "Config" || called.member !== CONFIG_MAP) return false;
  const [mapper] = argument.arguments;
  if (mapper === undefined || mapper.type === "SpreadElement") return false;
  const made = namespaceMemberOf(mapper);
  return made?.namespace === "Redacted" && made.member === REDACTED_MAKE;
};

const isRedactedConfig = (read: ESTree.CallExpression, definitions: LocalDefinitions): boolean => {
  const called = namespaceMemberOf(read.callee);
  if (called !== null && REDACTED_CONFIG_READERS.has(called.member)) return true;
  const [schema] = read.arguments;
  if (
    called?.member === "schema" &&
    schema !== undefined &&
    schema.type !== "SpreadElement" &&
    isRedactedSchema(schema, definitions, new Set())
  ) {
    return true;
  }
  const { parent } = read;
  if (parent.type !== "MemberExpression" || parent.object !== read) return false;
  const piped = parent.parent;
  return piped.type === "CallExpression" && piped.arguments.some(mapsToRedacted);
};

const localDefinitionsOf = (program: ESTree.Program): LocalDefinitions =>
  new Map(
    program.body.flatMap((statement) => {
      const declaration =
        statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
      if (declaration?.type !== "VariableDeclaration") return [];
      return declaration.declarations.flatMap((declarator) =>
        declarator.id.type === "Identifier" && declarator.init !== null
          ? [[declarator.id.name, declarator.init] as const]
          : [],
      );
    }),
  );

export const noPlainSecretEnvironmentKey = createDontReviewItRule({
  name: "no-plain-secret-environment-key--wrap-it-in-redacted",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow declaring an environment key whose name marks it as a secret without wrapping its value in `Redacted`, so the value cannot reach a log, an error message or a trace as plain text",
      relatedGuidelines: [".claude/skills/reviews/references/secrets-and-permissions.md"],
    },
    messages: {
      plainSecret:
        "A secret environment key such as `{{name}}` must not be declared without `Redacted`. Declare it with `Schema.Redacted(...)` in the schema, or read it with `Config.Redacted(...)`, and unwrap it only where the value is handed to the service that needs it.",
    },
    schema: [],
  },
  create(inspection) {
    const definitions: { current: LocalDefinitions } = { current: new Map() };
    const visitor = environmentKeyVisitor((occurrence) => {
      const { name, declaration } = occurrence;
      if (name === null || declaration === null || !SECRET_KEY.test(name)) return;
      const redacted =
        occurrence.place === "schema"
          ? isRedactedSchema(declaration, definitions.current, new Set())
          : declaration.type === "CallExpression" &&
            isRedactedConfig(declaration, definitions.current);
      if (redacted) return;
      inspection.report({ node: occurrence.node, messageId: "plainSecret", data: { name } });
    });
    return {
      ...visitor,
      Program(node: ESTree.Program) {
        definitions.current = localDefinitionsOf(node);
        visitor.Program(node);
      },
    };
  },
});
