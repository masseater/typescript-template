import { ConsentPage } from "#pages/consent/index.ts";
import { Schema } from "effect";
import { createFileRoute } from "@tanstack/react-router";
import uiStyles from "#app/auth.css?url";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ client_id: Schema.optionalKey(Schema.String) }),
);

// oxlint-disable-next-line eslint/sort-keys
const Route = createFileRoute("/consent")({
  validateSearch: searchSchema,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
  component: ConsentPage,
});

export { Route };
