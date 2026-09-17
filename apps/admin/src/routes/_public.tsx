import { PublicFrame } from "#components/public-frame.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_public")({ component: PublicFrame });

export { Route };
