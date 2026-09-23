import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { ConsentPage } from "#pages/consent/index.ts";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ client_id: Schema.optionalKey(Schema.String) }),
);

const Route = createFileRoute("/consent")({
  validateSearch: searchSchema,
  component: ConsentPage,
});

export { Route };
