import { createFileRoute } from "@tanstack/react-router";

import { RecoverPage } from "#pages/recover/index.ts";

const Route = createFileRoute("/_public/recover")({ component: RecoverPage });

export { Route };
