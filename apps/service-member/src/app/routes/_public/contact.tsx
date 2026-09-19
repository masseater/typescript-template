import { createFileRoute } from "@tanstack/react-router";

import { ContactPage } from "#pages/contact/index.ts";

const Route = createFileRoute("/_public/contact")({ component: ContactPage });

export { Route };
