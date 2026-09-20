import { VerifyEmailPage } from "@repo/auth-ui";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_public/verify-email")({ component: VerifyEmailPage });

export { Route };
