import { VerifyEmailPage } from "@template/ui/auth";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/verify-email")({ component: VerifyEmailPage });

export { Route };
