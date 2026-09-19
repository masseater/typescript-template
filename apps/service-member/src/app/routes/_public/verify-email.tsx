import { createFileRoute } from "@tanstack/react-router";

import { VerifyEmailPage } from "#pages/verify-email/index.ts";

const Route = createFileRoute("/_public/verify-email")({ component: VerifyEmailPage });

export { Route };
