import { createFileRoute } from "@tanstack/react-router";
import { VerifyEmailPage } from "@template/ui/auth";

export const Route = createFileRoute("/verify-email")({ component: VerifyEmailPage });
