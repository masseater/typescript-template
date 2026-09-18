import { Result, Schema } from "effect";
import type { Application } from "@template/config";
import type { Decodable } from "./contracts.ts";
import type { DocumentDecoration } from "elysia";
import { ErrorBody } from "./contracts.ts";
import type { JsonSchema } from "effect";
import { declaredStatuses } from "./failures.ts";
import { httpStatus } from "@template/observability";
import { openapi } from "@elysiajs/openapi";
import { scalarReferencePath } from "@template/config";

interface RouteDetail {
  readonly detail: DocumentDecoration;
}
type RouteSpec<Input extends Decodable, Value, Encoded> = {
  readonly response: Schema.Codec<Value, Encoded>;
} & (
  | { readonly body: Input; readonly query?: never }
  | { readonly body?: never; readonly query: Input }
  | { readonly body?: never; readonly query?: never }
);
type Parameters = NonNullable<DocumentDecoration["parameters"]>;
type ParameterSchema = NonNullable<Extract<Parameters[number], { name: string }>["schema"]>;
interface Content {
  content: { "application/json": { schema: JsonSchema.JsonSchema } };
}

const inlined = { referencePolicy: (): undefined => undefined } as const;
const hidden: RouteDetail = { detail: { hide: true } };
const docsPath = "/docs";
const failureDescription = "失敗したときの本文";
const successDescription = "成功したときの本文";
const ObjectSchema = Schema.Struct({
  properties: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
  required: Schema.optionalKey(Schema.Array(Schema.String)),
});
const readObjectSchema = Schema.decodeUnknownResult(ObjectSchema);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function jsonSchema(contract: Decodable): JsonSchema.JsonSchema {
  return Schema.toJsonSchemaDocument(contract, inlined).schema;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function jsonContent(contract: Decodable): Content {
  return { content: { "application/json": { schema: jsonSchema(contract) } } };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function queryParameters(contract: Decodable): Parameters {
  const decoded = readObjectSchema(jsonSchema(contract));
  if (Result.isFailure(decoded)) {
    return [];
  }
  const { properties, required } = decoded.success;
  const names = new Set(required);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return Object.entries(properties).map(([name, property]) => ({
    in: "query",
    name,
    required: names.has(name),
    schema: property as ParameterSchema,
  }));
}

function failureResponses(failures: object): DocumentDecoration["responses"] {
  const body = { ...jsonContent(ErrorBody), description: failureDescription };
  return Object.fromEntries(declaredStatuses(failures).map((status) => [status, body]));
}

function routeDetail<Input extends Decodable, Value, Encoded>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  spec: RouteSpec<Input, Value, Encoded>,
  failures: object,
): RouteDetail {
  const { body, query, response } = spec;
  const detail: DocumentDecoration = {
    responses: {
      ...failureResponses(failures),
      [httpStatus.ok]: { ...jsonContent(response), description: successDescription },
    },
  };
  if (body !== undefined) {
    detail.requestBody = { ...jsonContent(body), required: true };
  }
  if (query !== undefined) {
    detail.parameters = queryParameters(query);
  }
  return { detail };
}

function referencePage(audience: Application): Response {
  const configuration = JSON.stringify({ url: "docs/json", withDefaultFonts: false });
  const body = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${audience}</title>
  </head>
  <body>
    <script id="api-reference" data-configuration='${configuration}'></script>
    <script src="${scalarReferencePath}"></script>
  </body>
</html>
`;
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function apiDocs(audience: Application) {
  return openapi({
    documentation: { info: { title: audience, version: "" } },
    path: docsPath,
    // oxlint-disable-next-line unicorn/no-null
    provider: null,
  }).get(docsPath, () => referencePage(audience), hidden);
}

export { apiDocs, hidden, routeDetail };
export type { RouteDetail, RouteSpec };
