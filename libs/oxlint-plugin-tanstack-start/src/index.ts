import tanstackStart from "@tanstack/eslint-plugin-start";
import { Option, Predicate, Record, pipe } from "effect";
import type { Context, CreateRule, Plugin, RuleMeta, Visitor } from "vite-plus/lint/plugins";

import { createParserServices } from "./parser-services.ts";
import type { ParserServices } from "./parser-services.ts";
import { programFor } from "./program.ts";

interface TypedContext {
  readonly filename: string;
  readonly cwd: string;
  readonly options: readonly unknown[];
  readonly languageOptions: Readonly<Context["languageOptions"]>;
  readonly report: Context["report"];
  readonly sourceCode: { readonly parserServices: ParserServices };
}

interface TypedRule {
  readonly meta: RuleMeta;
  readonly create: (context: TypedContext) => Visitor;
}

const isTypedRule = <Rule>(rule: Rule): rule is Rule & TypedRule =>
  Predicate.hasProperty(rule, "meta") &&
  Predicate.hasProperty(rule, "create") &&
  Predicate.isFunction(rule.create);

const typedContext = (context: Context, parserServices: ParserServices): TypedContext => ({
  filename: context.filename,
  cwd: context.cwd,
  options: context.options,
  languageOptions: context.languageOptions,
  report: (diagnostic) => {
    context.report(diagnostic);
  },
  sourceCode: { parserServices },
});

const withTypeInformation = (rule: TypedRule): CreateRule => ({
  meta: rule.meta,
  create: (context) =>
    programFor(context.filename).pipe(
      Option.flatMap((program) =>
        Option.fromNullishOr(program.getSourceFile(context.filename)).pipe(
          Option.map((sourceFile) =>
            rule.create(
              typedContext(context, createParserServices({ context, program, sourceFile })),
            ),
          ),
        ),
      ),
      Option.getOrElse(() => ({})),
    ),
});

const plugin = {
  meta: { name: "tanstack-start" },
  rules: pipe(tanstackStart.rules, Record.filter(isTypedRule), Record.map(withTypeInformation)),
} as const satisfies Plugin;

export default plugin;
