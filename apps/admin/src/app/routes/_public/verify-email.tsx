import { createFileRoute } from "@tanstack/react-router";

import { VerifyEmailPage } from "@repo/ui/auth";

const Route = createFileRoute("/_public/verify-email")({ component: VerifyEmailPage });

export { Route };
