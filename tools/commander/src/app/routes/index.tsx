import { createFileRoute } from "@tanstack/react-router";

import { CommanderPage } from "#pages/commander/index.ts";

const Route = createFileRoute("/")({ component: CommanderPage });

export { Route };
