import { UsersPage } from "#components/users-page.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/")({ component: UsersPage });

export { Route };
