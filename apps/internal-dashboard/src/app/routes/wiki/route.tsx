import { createFileRoute } from "@tanstack/react-router";

import { WikiLayout } from "#widgets/wiki-frame/index.ts";

const Route = createFileRoute("/wiki")({ component: WikiLayout });

export { Route };
