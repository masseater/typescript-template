import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "#/pages/landing";

const Route = createFileRoute("/")({ component: LandingPage });

export { Route };
