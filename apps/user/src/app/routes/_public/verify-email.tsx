import { VerifyEmailPage } from "#pages/verify-email/index.ts";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_public/verify-email")({ component: VerifyEmailPage });

export { Route };
