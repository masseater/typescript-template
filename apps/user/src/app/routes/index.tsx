import { ProfilePage } from "#pages/profile/index.ts";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/")({ component: ProfilePage });

export { Route };
