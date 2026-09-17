import { SignUpPage } from "#components/signup-page.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/signup")({ component: SignUpPage });

export { Route };
