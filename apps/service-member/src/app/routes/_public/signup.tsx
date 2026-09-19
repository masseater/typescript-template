import { createFileRoute } from "@tanstack/react-router";

import { SignUpPage } from "#pages/signup/index.ts";

const Route = createFileRoute("/_public/signup")({ component: SignUpPage });

export { Route };
