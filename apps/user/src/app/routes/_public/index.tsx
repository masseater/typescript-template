import { LandingPage } from "#pages/landing/index.ts";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_public/")({ component: LandingPage });

export { Route };
