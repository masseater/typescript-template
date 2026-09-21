import { createFileRoute } from "@tanstack/react-router";

import { ContactPage } from "#pages/public/contact/index.ts";

const Route = createFileRoute("/_public/contact")({ component: ContactPage });

export { Route };
