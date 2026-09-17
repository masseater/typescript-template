import { object, optional, string } from "valibot";
import { ConsentPage } from "#/components/consent-page.tsx";
import { createFileRoute } from "@tanstack/react-router";
import uiStyles from "@template/ui/styles.css?url";

const searchSchema = object({ client_id: optional(string()) });

const Route = createFileRoute("/consent")({
  component: ConsentPage,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
  validateSearch: searchSchema,
});

export { Route };
