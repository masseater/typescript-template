import { SignUpPage } from "#pages/signup/index.ts";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_public/signup")({ component: SignUpPage });

export { Route };
