import { createFileRoute } from "@tanstack/react-router";

import { WikiLayout } from "./-wiki-layout.tsx";

const Route = createFileRoute("/wiki")({ component: WikiLayout });

export { Route };
