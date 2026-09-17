import { SecurityPage } from "#components/security-page.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/security")({ component: SecurityPage });

export { Route };
