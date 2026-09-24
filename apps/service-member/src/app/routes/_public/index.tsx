import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "#pages/public/landing/index.ts";

const Route = createFileRoute("/_public/")({ component: LandingPage });

export { Route };
