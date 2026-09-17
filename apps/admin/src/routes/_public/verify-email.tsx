import { VerifyEmailPage } from "@template/ui/auth";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_public/verify-email")({ component: VerifyEmailPage });

export { Route };
