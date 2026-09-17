import { LoginPage } from "#components/login-page.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/login")({ component: LoginPage });

export { Route };
