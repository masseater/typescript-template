import { createFileRoute } from "@tanstack/react-router";

import { RecordingsRoute, loadRecordings } from "#pages/recordings/index.ts";

const Route = createFileRoute("/_dashboard/recordings/")({
  component: RecordingsRoute,
  loader: () => loadRecordings(),
});

export { Route };
