import { httpStatus, scalarReferencePath, type Application } from "@repo/config";
import { Option, Result, Schema, type JsonSchema } from "effect";

import { ErrorBody, type Decodable } from "./contracts.ts";
import { declaredStatuses, type AnyFailureTable } from "./failures.ts";

import type { DocumentDecoration } from "elysia/types";

type QueryContract = {
  readonly fields: Schema.Struct.Fields;
};
type RouteSpec<Input extends Decodable, Value, Encoded> = {
  readonly response: Schema.Codec<Value, Encoded>;
} & (
  | { readonly body: Input; readonly query?: never }
  | { readonly body?: never; readonly query: Input & QueryContract }
  | { readonly body?: never; readonly query?: never }
);
type Parameters = NonNullable<DocumentDecoration["parameters"]>;
type RouteDetail = { readonly detail: DocumentDecoration };
type Guard = (context: { readonly request: Request }) => Promise<Response | undefined>;

const inlined = { referencePolicy: (): undefined => undefined } as const;
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
const DocumentedRoute = Schema.Struct({
  hooks: Schema.optionalKey(
    Schema.Struct({
      detail: Schema.optionalKey(
        Schema.Struct({
          hide: Schema.optionalKey(Schema.Boolean),
          parameters: Schema.optionalKey(Schema.Unknown),
          requestBody: Schema.optionalKey(Schema.Unknown),
          responses: Schema.optionalKey(Schema.Unknown),
        }),
      ),
    }),
  ),
  method: Schema.String,
  path: Schema.String,
});
const readRoute = Schema.decodeUnknownOption(DocumentedRoute);
const hidden: RouteDetail = { detail: { hide: true } };

const jsonSchema = (contract: Decodable): JsonSchema.JsonSchema =>
  Schema.toJsonSchemaDocument(contract, inlined).schema;

const queryParameters = (contract: Decodable & QueryContract): Parameters => {
  const { properties, required } = Result.getOrThrow(
    Schema.decodeUnknownResult(ObjectSchema)(jsonSchema(contract)),
  );
  const requiredFields = new Set(required);
  return Object.entries(properties).map(([fieldName, property]) => ({
    in: "query",
    name: fieldName,
    required: requiredFields.has(fieldName),
    schema: property as NonNullable<Extract<Parameters[number], { name: string }>["schema"]>,
  }));
};

const jsonContent = (
  contract: Decodable,
): { content: { "application/json": { schema: JsonSchema.JsonSchema } } } => ({
  content: { "application/json": { schema: jsonSchema(contract) } },
});

const failureResponses = (failures: AnyFailureTable): DocumentDecoration["responses"] => {
  const failureContent = { ...jsonContent(ErrorBody), description: failureDescription };
  return Object.fromEntries(
    declaredStatuses(failures).map((failureStatus) => [failureStatus, failureContent]),
  );
};

const routeDetail = <Input extends Decodable, Value, Encoded>(
  spec: RouteSpec<Input, Value, Encoded>,
  failures: AnyFailureTable,
): RouteDetail => ({
  detail: {
    ...(spec.body === undefined
      ? {}
      : { requestBody: { ...jsonContent(spec.body), required: true } }),
    ...(spec.query === undefined ? {} : { parameters: queryParameters(spec.query) }),
    responses: {
      ...failureResponses(failures),
      [httpStatus.ok]: { ...jsonContent(spec.response), description: successDescription },
    },
  },
});

const operationOf = (
  detail: NonNullable<NonNullable<typeof DocumentedRoute.Type.hooks>["detail"]> | undefined,
): Readonly<Record<string, unknown>> => ({
  ...(detail?.parameters === undefined ? {} : { parameters: detail.parameters }),
  ...(detail?.requestBody === undefined ? {} : { requestBody: detail.requestBody }),
  responses: detail?.responses ?? {},
});

const skippedMethods = new Set(["ALL", "HEAD", "OPTIONS"]);

const documentedOperation = (
  served: unknown,
): readonly [string, string, Readonly<Record<string, unknown>>] | undefined => {
  const route = Option.getOrUndefined(readRoute(served));
  if (
    route === undefined ||
    route.hooks?.detail?.hide === true ||
    skippedMethods.has(route.method.toUpperCase())
  ) {
    return undefined;
  }
  return [route.path, route.method.toLowerCase(), operationOf(route.hooks?.detail)];
};

const openApiDocument = (
  routes: readonly unknown[],
  audience: Application,
): {
  readonly info: { readonly description: string; readonly title: string; readonly version: string };
  readonly openapi: "3.0.3";
  readonly paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
} => ({
  info: { description: `${audience} の HTTP API`, title: audience, version: "1" },
  openapi: "3.0.3",
  paths: routes
    .map(documentedOperation)
    .reduce<Readonly<Record<string, Readonly<Record<string, unknown>>>>>(
      (documented, operation) =>
        operation === undefined
          ? documented
          : {
              ...documented,
              [operation[0]]: { ...documented[operation[0]], [operation[1]]: operation[2] },
            },
      {},
    ),
});

const referencePage = (audience: Application): Response =>
  new Response(
    `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${audience}</title>
  </head>
  <body>
    <script id="api-reference" type="application/json" data-configuration='${JSON.stringify(referenceConfiguration)}'></script>
    <script src="${scalarReferencePath}"></script>
  </body>
</html>
`,
    {
      headers: {
        "content-security-policy": referencePolicy,
        "content-type": "text/html; charset=utf-8",
      },
    },
  );

export { docsPath, hidden, openApiDocument, referencePage, routeDetail };
export type { Guard, QueryContract, RouteDetail, RouteSpec };
