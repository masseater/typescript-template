import { Schema } from "effect";

const isStringAttribute = Schema.is(
  Schema.Struct({
    name: Schema.String,
    type: Schema.Literal("mdxJsxAttribute"),
    value: Schema.String,
  }),
);

const termLinkAttribute = (
  attributes: readonly unknown[],
  attributeName: "label" | "term",
): string | undefined =>
  attributes
    .filter((attribute) => isStringAttribute(attribute))
    .find((attribute) => attribute.name === attributeName)?.value;

export { termLinkAttribute };
