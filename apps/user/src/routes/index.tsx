import { ProfilePage } from "#components/profile-page.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/")({ component: ProfilePage });

export { Route };
