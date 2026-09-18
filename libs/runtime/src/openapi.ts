import type { AnyFailureTable } from "./failures.ts";
import type { Application } from "@template/config";
import type { Decodable } from "./contracts.ts";
import type { DocumentDecoration } from "elysia";
import { Elysia } from "elysia";
import { ErrorBody } from "./contracts.ts";
import type { JsonSchema } from "effect";
import { Schema } from "effect";
import { declaredStatuses } from "./failures.ts";
import { httpStatus } from "@template/observability";
import { openapi } from "@elysiajs/openapi";
import { scalarReferencePath } from "@template/config";

interface RouteDetail {
  readonly detail: DocumentDecoration;
}
interface QueryContract {
  readonly fields: Schema.Struct.Fields;
}
type RouteSpec<Input extends Decodable, Value, Encoded> = {
  readonly response: Schema.Codec<Value, Encoded>;
} & (
  | { readonly body: Input; readonly query?: never }
  | { readonly body?: never; readonly query: Input & QueryContract }
  | { readonly body?: never; readonly query?: never }
);
type Parameters = NonNullable<DocumentDecoration["parameters"]>;
type ParameterSchema = NonNullable<Extract<Parameters[number], { name: string }>["schema"]>;
type Guard = (context: { readonly request: Request }) => Promise<Response | undefined>;
interface Content {
  content: { "application/json": { schema: JsonSchema.JsonSchema } };
}

const inlined = { referencePolicy: (): undefined => undefined } as const;
const hidden: RouteDetail = { detail: { hide: true } };
const docsPath = "/docs";
const failureDescription = "失敗したときの本文";
const successDescription = "成功したときの本文";
const referenceConfiguration = {
  agent: { disabled: true },
  mcp: { disabled: true },
  showDeveloperTools: "never",
  telemetry: false,
  url: "docs/json",
  withDefaultFonts: false,
} as const;
const referencePolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");
const ObjectSchema = Schema.Struct({
  properties: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
  required: Schema.optionalKey(Schema.Array(Schema.String)),
});
const readObjectSchema = Schema.decodeUnknownSync(ObjectSchema);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function jsonSchema(contract: Decodable): JsonSchema.JsonSchema {
  return Schema.toJsonSchemaDocument(contract, inlined).schema;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function jsonContent(contract: Decodable): Content {
  return { content: { "application/json": { schema: jsonSchema(contract) } } };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function queryParameters(contract: Decodable & QueryContract): Parameters {
  const { properties, required } = readObjectSchema(jsonSchema(contract));
  const names = new Set(required);
  return Object.entries(properties).map(([name, property]) => ({
    in: "query",
    name,
    required: names.has(name),
    schema: property as ParameterSchema,
  }));
}

function failureResponses(failures: AnyFailureTable): DocumentDecoration["responses"] {
  const body = { ...jsonContent(ErrorBody), description: failureDescription };
  return Object.fromEntries(declaredStatuses(failures).map((status) => [status, body]));
}

function routeDetail<Input extends Decodable, Value, Encoded>(
  spec: RouteSpec<Input, Value, Encoded>,
  failures: AnyFailureTable,
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
  const configuration = JSON.stringify(referenceConfiguration);
  const body = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${audience}</title>
  </head>
  <body>
    <script id="api-reference" type="application/json" data-configuration='${configuration}'></script>
    <script src="${scalarReferencePath}"></script>
  </body>
</html>
`;
  return new Response(body, {
    headers: {
      "content-security-policy": referencePolicy,
      "content-type": "text/html; charset=utf-8",
    },
  });
}

async function open(): Promise<undefined> {
  return Promise.resolve(undefined);
}

function apiDocs(audience: Application, guard: Guard = open) {
  return new Elysia()
    .onBeforeHandle(guard)
    .use(
      openapi({
        documentation: {
          info: { description: `${audience} の HTTP API`, title: audience, version: "1" },
        },
        path: docsPath,
        // oxlint-disable-next-line unicorn/no-null
        provider: null,
      }),
    )
    .get(docsPath, () => referencePage(audience), hidden);
}

export { apiDocs, hidden, routeDetail };
export type { Guard, RouteDetail, RouteSpec };
