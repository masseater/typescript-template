import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "#pages/landing/index.ts";

const Route = createFileRoute("/_public/")({ component: LandingPage });

export { Route };
